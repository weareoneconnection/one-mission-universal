// apps/web/src/lib/server/chainQueue.ts
import "server-only";
import { getRedis } from "@/lib/server/redis";

const QKEY = "om:chain:queue:v1";
/** ✅ 去重索引：同一个 proofId 只能在队列里出现一次 */
const QSET = "om:chain:queue:set:v1";

const META_LAST_SYNC = "om:chain:lastSyncAt";
const META_FINALIZED = "om:chain:finalizedCount";
const META_LAST_ERROR = "om:chain:lastError";

type Driver = "memory" | "redis" | "kv";
function pickDriver(): Driver {
  const v = String(process.env.CHAIN_QUEUE_DRIVER || process.env.MISSION_STORE_DRIVER || "memory")
    .toLowerCase()
    .trim();
  if (v === "redis") return "redis";
  if (v === "kv") return "kv";
  return "memory";
}

// ---- memory db (dev) ----
type MemDB = {
  q: string[];
  qset: Set<string>;
  lastSyncAt?: number;
  finalizedCount: number;
  lastError?: string | null;
};
function getMemDB(): MemDB {
  const g = globalThis as any;
  if (!g.__OM_CHAIN_QUEUE__) {
    g.__OM_CHAIN_QUEUE__ = { q: [], qset: new Set(), finalizedCount: 0, lastError: null };
  }
  // 兼容老数据（以前没有 qset）
  if (!g.__OM_CHAIN_QUEUE__.qset) g.__OM_CHAIN_QUEUE__.qset = new Set();
  return g.__OM_CHAIN_QUEUE__ as MemDB;
}

/* =========================
   Queue ops
========================= */

export async function enqueueProof(proofId: string) {
  const id = String(proofId || "").trim();
  if (!id) return;

  const driver = pickDriver();

  if (driver === "memory") {
    const db = getMemDB();
    if (db.qset.has(id)) return; // ✅ 去重
    db.qset.add(id);
    db.q.unshift(id);
    return;
  }

  if (driver === "redis") {
    const r = await getRedis();

    // ✅ 去重：只有第一次 SADD 成功才入队
    const added = await r.sadd(QSET, id);
    if (!added) return;

    try {
      await r.lpush(QKEY, id);
    } catch (e) {
      // 如果 lpush 失败，把 set 回滚，避免“永远无法再入队”
      try {
        await r.srem(QSET, id);
      } catch {}
      throw e;
    }
    return;
  }

  // kv: use Redis ops (atomic enough for our use)
  const { kv } = await import("@vercel/kv");

  const added = await kv.sadd(QSET, id);
  if (!added) return;

  try {
    await kv.lpush(QKEY, id);
  } catch (e) {
    try {
      await kv.srem(QSET, id);
    } catch {}
    throw e;
  }
}

export async function dequeueProof(): Promise<string | null> {
  const driver = pickDriver();

  if (driver === "memory") {
    const db = getMemDB();
    const v = db.q.pop();
    if (!v) return null;
    db.qset.delete(v); // ✅ 出队后释放去重索引
    return v ?? null;
  }

  if (driver === "redis") {
    const r = await getRedis();
    const v = await r.rpop(QKEY);
    if (!v) return null;

    const id = String(v);
    // ✅ 出队后释放去重索引（允许未来再次入队，比如重试）
    try {
      await r.srem(QSET, id);
    } catch {}
    return id;
  }

  const { kv } = await import("@vercel/kv");
  const v = await kv.rpop(QKEY);
  if (!v) return null;

  const id = String(v);
  try {
    await kv.srem(QSET, id);
  } catch {}
  return id;
}

export async function queueLength(): Promise<number> {
  const driver = pickDriver();
  if (driver === "memory") return getMemDB().q.length;

  if (driver === "redis") {
    const r = await getRedis();
    const n = await r.llen(QKEY);
    return Number(n || 0);
  }

  const { kv } = await import("@vercel/kv");
  const n = await kv.llen(QKEY);
  return Number(n || 0);
}

/* =========================
   Meta
========================= */

export async function setLastSyncAt(ts: number) {
  const driver = pickDriver();
  if (driver === "memory") {
    getMemDB().lastSyncAt = ts;
    return;
  }

  if (driver === "redis") {
    const r = await getRedis();
    await r.set(META_LAST_SYNC, String(ts));
    return;
  }

  const { kv } = await import("@vercel/kv");
  await kv.set(META_LAST_SYNC, ts);
}

export async function getLastSyncAt(): Promise<number | null> {
  const driver = pickDriver();
  if (driver === "memory") return getMemDB().lastSyncAt ?? null;

  if (driver === "redis") {
    const r = await getRedis();
    const v = await r.get(META_LAST_SYNC);
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  const { kv } = await import("@vercel/kv");
  const v = await kv.get(META_LAST_SYNC);
  const n = Number(v ?? NaN);
  return Number.isFinite(n) ? n : null;
}

export async function incFinalizedCount(by = 1) {
  const driver = pickDriver();
  if (driver === "memory") {
    getMemDB().finalizedCount += by;
    return;
  }

  if (driver === "redis") {
    const r = await getRedis();
    await r.incrby(META_FINALIZED, by);
    return;
  }

  const { kv } = await import("@vercel/kv");
  const cur = Number((await kv.get(META_FINALIZED)) ?? 0);
  await kv.set(META_FINALIZED, cur + by);
}

export async function getFinalizedCount(): Promise<number> {
  const driver = pickDriver();
  if (driver === "memory") return getMemDB().finalizedCount;

  if (driver === "redis") {
    const r = await getRedis();
    const v = await r.get(META_FINALIZED);
    const n = Number(v || 0);
    return Number.isFinite(n) ? n : 0;
  }

  const { kv } = await import("@vercel/kv");
  const n = Number((await kv.get(META_FINALIZED)) ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function setLastError(msg: string | null) {
  const driver = pickDriver();
  if (driver === "memory") {
    getMemDB().lastError = msg;
    return;
  }

  if (driver === "redis") {
    const r = await getRedis();
    if (!msg) {
      await r.del(META_LAST_ERROR);
      return;
    }
    await r.set(META_LAST_ERROR, msg.slice(0, 500));
    return;
  }

  const { kv } = await import("@vercel/kv");
  if (!msg) {
    await kv.del(META_LAST_ERROR);
    return;
  }
  await kv.set(META_LAST_ERROR, msg.slice(0, 500));
}

export async function getLastError(): Promise<string | null> {
  const driver = pickDriver();
  if (driver === "memory") return (getMemDB().lastError as any) ?? null;

  if (driver === "redis") {
    const r = await getRedis();
    const v = await r.get(META_LAST_ERROR);
    return v ? String(v) : null;
  }

  const { kv } = await import("@vercel/kv");
  const v = await kv.get(META_LAST_ERROR);
  return v ? String(v) : null;
}
