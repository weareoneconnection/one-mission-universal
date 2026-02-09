import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getHeaderWallet } from "@/lib/server/auth";
import { getProofById, saveProof } from "@/lib/proof-store";
import type { Proof, ProofEvent } from "@/lib/types";
import { nanoid } from "nanoid";
import { getMissionById } from "@/lib/missions/store";

/* 🔧 PATCH：仅新增（不影响原结构） */
import { enqueueProof } from "@/lib/server/chainQueue";
import { updateChainQueueItem } from "@/lib/server/chainProofStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_REPUTATION_APPROVE = 1;
console.log("[HIT] /api/proofs/[proofId]/approve");

/* -------------------------
  helpers（与 reject 同逻辑）
------------------------- */
function safeTrim(v: any) {
  return String(v ?? "").trim();
}

function getProofIdFromReq(req: NextRequest, params?: { proofId?: string }) {
  const fromParams = safeTrim(params?.proofId);
  if (fromParams) return fromParams;

  try {
    const pathname = new URL(req.url).pathname;
    const parts = pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("proofs");
    const fromPath = idx >= 0 ? safeTrim(parts[idx + 1]) : "";
    if (fromPath) return fromPath;
  } catch {}

  return "";
}

function clampNote(note: string) {
  const n = safeTrim(note);
  if (!n) return "";
  return n.length > 500 ? n.slice(0, 500) : n;
}

/* =========================
   POST /api/proofs/:proofId/approve
========================= */
type Ctx = {
  params: Promise<{
    proofId: string;
  }>;
};

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { proofId } = await ctx.params;

    // ✅ proofId 兜底解析
    const finalProofId = getProofIdFromReq(req, { proofId });
    if (!finalProofId) {
      return NextResponse.json({ ok: false, error: "MISSING_PROOF_ID" }, { status: 400 });
    }

    // 🔎 观测：确认命中的是哪个路由 & proofId 解析是否正确
    const path = (() => {
      try {
        return new URL(req.url).pathname;
      } catch {
        return "";
      }
    })();
    console.log("[approve] path=", path, "proofId=", proofId, "finalProofId=", finalProofId);

    // ✅ 只认 header 钱包
    const adminWallet = getHeaderWallet(req);
    if (!adminWallet) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const proof = await getProofById(finalProofId);
    if (!proof) {
      return NextResponse.json({ ok: false, error: "PROOF_NOT_FOUND" }, { status: 404 });
    }

    if (proof.currentStatus !== "PENDING") {
      return NextResponse.json(
        { ok: false, error: "INVALID_PROOF_STATUS", status: proof.currentStatus },
        { status: 400 }
      );
    }

    // ✅ mission.weight → points
    const mission = await getMissionById(proof.missionId);
    if (!mission) {
      return NextResponse.json(
        { ok: false, error: "MISSION_NOT_FOUND", missionId: proof.missionId },
        { status: 404 }
      );
    }

    const pointsAwarded = Number((mission as any).weight) || 0;

    const body = await req.json().catch(() => ({}));
    const note = clampNote(body?.note);

    const now = Date.now();

    const event: ProofEvent = {
      id: `evt_${nanoid(10)}`,
      type: "APPROVED",
      at: now,
      by: adminWallet,
      reason: note || undefined,
    };

    const next: Proof = {
      ...proof,
      currentStatus: "APPROVED",
      points: pointsAwarded,
      reputationDelta: (proof.reputationDelta ?? 0) + DEFAULT_REPUTATION_APPROVE,
      events: [...(proof.events ?? []), event],
      updatedAt: now,
    };

    /* ✅ 原逻辑：保存 proof */
    await saveProof(next);

    /* 🔧 PATCH：approve 后自动入队（best-effort + 可观测） */
    let enqueueOk = false;
    let enqueueErr: string | null = null;
    const enqueueId = `enq_${nanoid(6)}`;

    try {
      await updateChainQueueItem(finalProofId, {
        userWallet: next.userWallet,
        chainStatus: "QUEUED",
        lastError: "",
        updatedAt: Date.now(),
      });
      await enqueueProof(finalProofId);
      enqueueOk = true;
      console.log("[approve] enqueued", { enqueueId, proofId: finalProofId });
    } catch (e: any) {
      enqueueErr = String(e?.message || e);
      console.warn("[approve] enqueue failed:", { enqueueId, err: enqueueErr });
    }

    /* ✅ 返回结构不变（只是额外带调试字段） */
    return NextResponse.json({
      ok: true,
      proof: next,
      enqueueOk,
      enqueueErr,
      enqueueId,
      path,
      proofId,
      finalProofId,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
