import { NextResponse } from "next/server";
import { getRedis } from "@/lib/server/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const r = await getRedis();
    const key = `om:ping:${Date.now()}`;
    await r.set(key, "1");
    const v = await r.get(key);
    return NextResponse.json({ ok: true, wrote: key, read: v });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "REDIS_FAILED", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
