// apps/web/src/app/api/admin/chain-reset/route.ts
import { NextResponse } from "next/server";
import { getRedis } from "@/lib/server/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

// ✅ 和 chainQueue.ts 保持一致
const QKEY = "om:chain:queue:v1";
const META_LAST_SYNC = "om:chain:lastSyncAt";
const META_FINALIZED = "om:chain:finalizedCount";
const META_LAST_ERROR = "om:chain:lastError";

// ✅ 如果你要做“去重入队”，通常会用一个 set key（推荐）
// 这里顺便清掉，避免历史数据干扰
const DEDUPE_KEY = "om:chain:queue:dedupe:v1";

type Driver = "memory" | "redis" | "kv";
function pickDriver(): Driver {
  const v = String(process.env.CHAIN_QUEUE_DRIVER || process.env.MISSION_STORE_DRIVER || "memory")
    .toLowerCase()
    .trim();
  if (v === "redis") return "redis";
  if (v === "kv") return "kv";
  return "memory";
}

function resetMemQueue() {
  const g = globalThis as any;
  g.__OM_CHAIN_QUEUE__ = { q: [], finalizedCount: 0, lastError: null, lastSyncAt: undefined };
}

export async function POST(req: Request) {
  try {
    const driver = pickDriver();

    if (driver === "memory") {
      resetMemQueue();
      return NextResponse.json({
        ok: true,
        driver,
        cleared: ["memory_queue", "memory_meta"],
      });
    }

    if (driver === "redis") {
      const r = await getRedis();
      await r.del(QKEY, META_LAST_SYNC, META_FINALIZED, META_LAST_ERROR, DEDUPE_KEY);
      return NextResponse.json({
        ok: true,
        driver,
        cleared: [QKEY, META_LAST_SYNC, META_FINALIZED, META_LAST_ERROR, DEDUPE_KEY],
      });
    }

    // kv
    const { kv } = await import("@vercel/kv");
    await kv.set(QKEY, []);
    await kv.del(META_LAST_SYNC);
    await kv.del(META_FINALIZED);
    await kv.del(META_LAST_ERROR);
    await kv.del(DEDUPE_KEY);

    return NextResponse.json({
      ok: true,
      driver,
      cleared: [QKEY, META_LAST_SYNC, META_FINALIZED, META_LAST_ERROR, DEDUPE_KEY],
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
