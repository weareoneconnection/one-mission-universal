// apps/web/src/lib/server/chainQueue.ts
import "server-only";
import { getRedis } from "@/lib/server/redis";

const QKEY = "om:chain:queue:v1";
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
  lastSyncAt?: number;
  finalizedCount: number;
  lastError?: string | null;
};
function getMemDB(): MemDB {
  const g = globalThis as any;
  if (!g.__OM_CHAIN_QUEUE__) {
    g.__OM_CHAIN_QUEUE__ = { q: [], finalizedCount: 0, lastError: null };
  }
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
    getMemDB().q.unshift(id);
    return;
  }

  if (driver === "redis") {
    const r = await getRedis();
    await r.lpush(QKEY, id);
    return;
  }

  // kv fallback: store as array (simple)
  const { kv } = await import("@vercel/kv");
  const arr = ((await kv.get(QKEY)) as string[] | null) ?? [];
  const next = Array.isArray(arr) ? arr : [];
  next.unshift(id);
  await kv.set(QKEY, next);
}

export async function dequeueProof(): Promise<string | null> {
  const driver = pickDriver();

  if (driver === "memory") {
    const v = getMemDB().q.pop();
    return v ?? null;
  }

  if (driver === "redis") {
    const r = await getRedis();
    const v = await r.rpop(QKEY);
    return v ? String(v) : null;
  }

  const { kv } = await import("@vercel/kv");
  const arr = ((await kv.get(QKEY)) as string[] | null) ?? [];
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const v = arr.pop()!;
  await kv.set(QKEY, arr);
  return v ?? null;
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
  const arr = (await kv.get(QKEY)) as string[] | null;
  return Array.isArray(arr) ? arr.length : 0;
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
