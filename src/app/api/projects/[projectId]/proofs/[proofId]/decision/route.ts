import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getHeaderWallet } from "@/lib/server/auth";
import { getProofById, saveProof } from "@/lib/proof-store";
import type { Proof, ProofEvent, ProofStatus } from "@/lib/types";
import { nanoid } from "nanoid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeTrim(v: any) {
  return String(v ?? "").trim();
}

type Decision = "APPROVE" | "REJECT" | "REVOKE";

type Ctx = {
  params: Promise<{
    projectId: string;
    proofId: string;
  }>;
};

const DECISION_TO_EVENT: Record<Decision, ProofEvent["type"]> = {
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  REVOKE: "REVOKED",
};

const EVENT_TO_STATUS: Record<ProofEvent["type"], ProofStatus> = {
  SUBMITTED: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  REVOKED: "REVOKED",
};

/**
 * POST /api/projects/:projectId/proofs/:proofId/decision
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { projectId, proofId } = await ctx.params;

    const pid = safeTrim(projectId);
    const prfId = safeTrim(proofId);

    if (!pid || !prfId) {
      return NextResponse.json({ ok: false, error: "MISSING_PARAMS" }, { status: 400 });
    }

    const adminWallet = getHeaderWallet(req);
    if (!adminWallet) {
      return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const decision = safeTrim(body?.decision).toUpperCase() as Decision;
    const reason = safeTrim(body?.reason);

    if (!["APPROVE", "REJECT", "REVOKE"].includes(decision)) {
      return NextResponse.json({ ok: false, error: "INVALID_DECISION" }, { status: 400 });
    }

    const proof = (await getProofById(prfId)) as Proof | null;
    if (!proof) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    // 防止跨项目
    if (proof.projectId !== pid) {
      return NextResponse.json({ ok: false, error: "PROJECT_MISMATCH" }, { status: 403 });
    }

    const now = Date.now();
    const evType = DECISION_TO_EVENT[decision];

    const ev: ProofEvent = {
      id: nanoid(),
      type: evType,
      at: now,
      by: adminWallet,
      reason: reason || undefined,
    };

    const nextStatus: ProofStatus = EVENT_TO_STATUS[ev.type];

    const next: Proof = {
      ...proof,
      currentStatus: nextStatus,
      updatedAt: now,
      events: [...(proof.events ?? []), ev],
      ...(ev.type === "APPROVED"
        ? { approvedAt: now, approvedBy: adminWallet }
        : {}),
    };

    await saveProof(next);
    return NextResponse.json({ ok: true, proof: next });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
