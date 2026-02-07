// apps/web/src/lib/ai-proofs/driver-kv.ts
import { getRedis } from "@/lib/server/redis";

/**
 * KV driver backed by Redis (Upstash / Vercel KV / REDIS_URL TCP).
 * Uses the unified get/set/del interface from getRedis().
 */

export async function kvGet(key: string) {
  const r = await getRedis();
  return r.get(key);
}

export async function kvSet(key: string, val: any) {
  const r = await getRedis();
  return r.set(key, val);
}

export async function kvDel(key: string) {
  const r = await getRedis();
  return r.del(key);
}
