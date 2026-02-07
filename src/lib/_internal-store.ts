/**
 * _internal-store.ts
 *
 * 支持：
 * - memory（本地开发）
 * - kv / redis（生产持久化）
 *
 * ✅ 对外 API 完全不变：
 *    getStore / setStore / delStore / dumpStore
 */

import "server-only";
import { getRedis } from "@/lib/server/redis";

type StoreValue = any;

type Driver = "memory" | "kv";
function pickDriver(): Driver {
  const v = String(process.env.MISSION_STORE_DRIVER || "memory").toLowerCase();
  return v === "kv" ? "kv" : "memory";
}

/* =========================
   Memory store（dev）
========================= */

declare global {
  // eslint-disable-next-line no-var
  var __ONE_MISSION_MEM_STORE__: Map<string, StoreValue> | undefined;
}

const mem: Map<string, StoreValue> =
  globalThis.__ONE_MISSION_MEM_STORE__ ??
  (globalThis.__ONE_MISSION_MEM_STORE__ = new Map());

/* =========================
   Public API（不变）
========================= */

export async function getStore<T = any>(key: string): Promise<T | null> {
  if (!key) return null;

  const driver = pickDriver();
  if (driver === "memory") {
    return (mem.has(key) ? mem.get(key) : null) as T | null;
  }

  const r = await getRedis();
  const v = await r.get(key);
  return (v as T) ?? null;
}

export async function setStore<T = any>(key: string, value: T): Promise<void> {
  if (!key) throw new Error("STORE_KEY_REQUIRED");

  const driver = pickDriver();
  if (driver === "memory") {
    mem.set(key, value);
    return;
  }

  const r = await getRedis();
  await r.set(key, value);
}

export async function delStore(key: string): Promise<void> {
  if (!key) return;

  const driver = pickDriver();
  if (driver === "memory") {
    mem.delete(key);
    return;
  }

  const r = await getRedis();
  await r.del(key);
}

/**
 * ⚠️ 仅用于调试
 * - memory：返回当前 Map
 * - kv：扫描 Redis（⚠️ 大数据量时别用）
 */
export async function dumpStore(): Promise<Record<string, any>> {
  const driver = pickDriver();

  if (driver === "memory") {
    return Object.fromEntries(mem.entries());
  }

  const r: any = await getRedis();
  if (typeof r.keys !== "function") {
    return {};
  }

  const keys: string[] = await r.keys("*");
  const out: Record<string, any> = {};
  for (const k of keys) {
    out[k] = await r.get(k);
  }
  return out;
}
