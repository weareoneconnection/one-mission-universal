import { NextResponse } from "next/server";
import { addPointsOnchain } from "@/lib/onchain/waocPointsAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const owner = String(body.owner || "").trim();
    const amount = Number(body.amount || 0);

    if (!owner) return NextResponse.json({ ok: false, error: "MISSING_OWNER" }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ ok: false, error: "INVALID_AMOUNT" }, { status: 400 });
    }

    const r = await addPointsOnchain({ owner, amount });
    const status = r.ok ? 200 : 500;
    return NextResponse.json(r, { status });
  } catch (e: any) {
    console.error("[/api/admin/add-points] ERROR:", e);
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", detail: String(e?.message || e) },
      { status: 500 }
    );
  }
}
