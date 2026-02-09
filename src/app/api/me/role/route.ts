// src/app/api/me/role/route.ts
import { NextResponse } from "next/server";
import { getHeaderWallet } from "@/lib/server/auth";
import { resolveWalletRole, defaultLanding } from "@/lib/server/role";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const wallet = getHeaderWallet(req);

  if (!wallet) {
    return NextResponse.json({
      ok: true,
      connected: false,
      role: "USER",
      landing: "/missions",
    });
  }

  const role = await resolveWalletRole(wallet);

  return NextResponse.json({
    ok: true,
    connected: true,
    wallet,
    role,
    landing: defaultLanding(role),
  });
}
