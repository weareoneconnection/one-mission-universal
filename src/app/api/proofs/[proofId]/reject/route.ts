import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getHeaderWallet } from "@/lib/server/auth";
import { getProofById, saveProof } from "@/lib/proof-store";
import type { Proof, ProofEvent } from "@/lib/types";
import { nanoid } from "nanoid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_REPUTATION_REJECT = -1;

/* -------------------------
  helpers（与 approve 同逻辑）
------------------------- */
function safeTrim(v: any) {
  return String(v ?? "").trim();
}

function getProofIdFromReq(
  req: NextRequest,
  params?: { proofId?: string }
) {
  // 1) Next params
  const fromParams = safeTrim(params?.proofId);
  if (fromParams) return fromParams;

  // 2) URL fallback: /api/proofs/:proofId/reject
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
   POST /api/proofs/:proofId/reject
========================= */
type Ctx = {
  params: Promise<{
    proofId: string;
  }>;
};

export async function POST(
  req: NextRequest,
  ctx: Ctx
) {
  try {
    const { proofId } = await ctx.params;

    // ✅ proofId 兜底解析（与 approve 一致）
    const finalProofId = getProofIdFromReq(req, { proofId });
    if (!finalProofId) {
      return NextResponse.json(
        { ok: false, error: "MISSING_PROOF_ID" },
        { status: 400 }
      );
    }

    // ✅ 只认 header 钱包
    const adminWallet = getHeaderWallet(req);
    if (!adminWallet) {
      return NextResponse.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const proof = await getProofById(finalProofId);
    if (!proof) {
      return NextResponse.json(
        { ok: false, error: "PROOF_NOT_FOUND" },
        { status: 404 }
      );
    }

    if (proof.currentStatus !== "PENDING") {
      return NextResponse.json(
        { ok: false, error: "INVALID_PROOF_STATUS", status: proof.currentStatus },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const note = clampNote(body?.note);

    const now = Date.now();

    const event: ProofEvent = {
      id: `evt_${nanoid(10)}`,
      type: "REJECTED",
      at: now,
      by: adminWallet,
      reason: note || undefined,
    };

    // ✅ 与 approve 完全同结构，只是数值 & 状态不同
    const next: Proof = {
      ...proof,
      currentStatus: "REJECTED",
      reputationDelta:
        (proof.reputationDelta ?? 0) + DEFAULT_REPUTATION_REJECT,
      events: [...(proof.events ?? []), event],
      updatedAt: now,
    };

    await saveProof(next);
    return NextResponse.json({ ok: true, proof: next });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
