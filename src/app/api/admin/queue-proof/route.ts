import { NextResponse } from "next/server";
import { enqueueProof } from "@/lib/server/chainQueue";
import { updateChainQueueItem } from "@/lib/server/chainProofStore";
import { getProofById } from "@/lib/proof-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function checkAdmin(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const got = req.headers.get("x-cron-secret") || "";
  return got === secret;
}

export async function POST(req: Request) {
  try {
    if (!checkAdmin(req)) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const proofId = String(body?.proofId || "").trim();
    if (!proofId) return NextResponse.json({ ok: false, error: "MISSING_PROOF_ID" }, { status: 400 });

    const proof = await getProofById(proofId);
    if (!proof) return NextResponse.json({ ok: false, error: "PROOF_NOT_FOUND" }, { status: 404 });

    await updateChainQueueItem(proofId, {
      userWallet: proof.userWallet,
      chainStatus: "QUEUED",
      lastError: "",
      updatedAt: Date.now(),
    });

    await enqueueProof(proofId);

    return NextResponse.json({ ok: true, queued: { proofId, userWallet: proof.userWallet } });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
