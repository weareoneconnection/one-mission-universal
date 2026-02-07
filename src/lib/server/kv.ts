import "server-only";
import { getRedis } from "@/lib/server/redis";

type Driver = "memory" | "kv";

function pickDriver(): Driver {
  const v = String(process.env.MISSION_STORE_DRIVER || "memory").toLowerCase();
  return v === "kv" ? "kv" : "memory";
}

// ---- memory store (dev) ----
type MemDB = { kv: Map<string, any> };
function getMemDB(): MemDB {
  const g = globalThis as unknown as { __ONE_MISSION_MEMDB__?: MemDB };
  if (!g.__ONE_MISSION_MEMDB__) g.__ONE_MISSION_MEMDB__ = { kv: new Map() };
  return g.__ONE_MISSION_MEMDB__;
}

export async function kvGet<T = any>(key: string): Promise<T | null> {
  const driver = pickDriver();
  if (driver === "memory") return (getMemDB().kv.get(key) as T) ?? null;

  const redis = await getRedis();
  const val = await redis.get(key);
  // upstash/kv 会返回已解析对象或字符串；这里统一兼容
  return (val as T) ?? null;
}

export async function kvSet(key: string, value: any): Promise<void> {
  const driver = pickDriver();
  if (driver === "memory") {
    getMemDB().kv.set(key, value);
    return;
  }

  const redis = await getRedis();
  await redis.set(key, value);
}

export async function kvDel(key: string): Promise<void> {
  const driver = pickDriver();
  if (driver === "memory") {
    getMemDB().kv.delete(key);
    return;
  }

  const redis = await getRedis();
  await redis.del(key);
}

export async function kvIncrBy(key: string, amount = 1): Promise<number> {
  const driver = pickDriver();
  if (driver === "memory") {
    const cur = Number(getMemDB().kv.get(key) || 0);
    const next = cur + amount;
    getMemDB().kv.set(key, next);
    return next;
  }

  const redis: any = await getRedis();
  // upstash 支持 incrby；vercel kv 也支持 incrBy 风格（不同实现）
  if (typeof redis.incrby === "function") return await redis.incrby(key, amount);
  if (typeof redis.incrBy === "function") return await redis.incrBy(key, amount);
  // fallback
  const cur = Number((await redis.get(key)) || 0);
  const next = cur + amount;
  await redis.set(key, next);
  return next;
}
