import { NextResponse } from "next/server";
import { listProofsByUser, summarizeProofs } from "@/lib/proof-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/profile/proofs?wallet=...
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const wallet = String(url.searchParams.get("wallet") || "").trim();

    if (!wallet) {
      return NextResponse.json(
        { ok: false, error: "MISSING_WALLET" },
        { status: 400 }
      );
    }

    // ✅ 关键：必须用同一套 proof-store 的读取逻辑
    const proofs = await listProofsByUser(wallet);
    const summary = summarizeProofs(proofs);

    return NextResponse.json(
      { ok: true, wallet, proofs, summary },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
