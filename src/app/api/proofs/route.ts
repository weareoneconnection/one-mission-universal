import { NextResponse } from "next/server";
import { listProofsByUser } from "@/lib/proof-store";
import { getHeaderWallet } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const qWallet = String(url.searchParams.get("wallet") || "").trim();
  const hWallet = getHeaderWallet(req);
  const wallet = qWallet || hWallet;

  if (!wallet) return NextResponse.json({ ok: true, proofs: [] });

  const proofs = await listProofsByUser(wallet);
  return NextResponse.json({ ok: true, proofs });
}
