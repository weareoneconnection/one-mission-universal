import { NextResponse } from "next/server";
import { getHeaderWallet } from "@/lib/server/auth";
import { listProofsByUser, summarizeProofs } from "@/lib/proof-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);

  const qWallet = String(url.searchParams.get("wallet") || "").trim();
  const hWallet = String(getHeaderWallet(req) || "").trim();
  const wallet = qWallet || hWallet;

  if (!wallet) return NextResponse.json({ ok: true, wallet: "", summary: null });

  const proofs = await listProofsByUser(wallet);
  const summary = summarizeProofs(proofs);

  return NextResponse.json({ ok: true, wallet, summary });
}
