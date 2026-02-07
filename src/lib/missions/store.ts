// apps/web/src/lib/missions/store.ts
import type { Mission } from "./types";
import type { CreateMissionInput } from "./validators";
import { getRedis } from "@/lib/server/redis";

type MemDB = {
  missions: Map<string, Mission>;
  missionsByProject: Map<string, Set<string>>;
};

function getMemDB(): MemDB {
  const g = globalThis as unknown as { __OMU_MISSIONS_MEMDB__?: MemDB };
  if (!g.__OMU_MISSIONS_MEMDB__) {
    g.__OMU_MISSIONS_MEMDB__ = {
      missions: new Map(),
      missionsByProject: new Map(),
    };
  }
  return g.__OMU_MISSIONS_MEMDB__;
}

function now() {
  return Date.now();
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Math.random()
    .toString(16)
    .slice(2)}`.slice(0, 22);
}

/* =========================
   Driver
========================= */

type Driver = "memory" | "redis" | "kv";

function pickDriver(): Driver {
  const v = String(process.env.MISSION_STORE_DRIVER || "memory").toLowerCase().trim();
  if (v === "redis") return "redis";
  if (v === "kv") return "kv";
  return "memory";
}

/* =========================
   Keys
========================= */

const KEY_ALL_IDS = "om:missions:index:v1"; // string[] mission ids
const keyMission = (id: string) => `om:missions:item:${id}`;
const keyProjectIndex = (projectId: string) => `om:missions:byProject:${projectId}`; // string[] ids

/* =========================
   Redis JSON helpers
========================= */

async function redisGetJson<T>(key: string): Promise<T | null> {
  const r: any = await getRedis();
  const v = await r.get(key);

  if (v == null) return null;

  // 兼容：某些封装可能直接返回对象/数组
  if (typeof v !== "string") return v as T;

  try {
    return JSON.parse(v) as T;
  } catch {
    // 兼容历史脏数据，避免炸
    return null;
  }
}

async function redisSetJson(key: string, value: any) {
  const r: any = await getRedis();
  const s = typeof value === "string" ? value : JSON.stringify(value);
  await r.set(key, s);
}

/* =========================
   Index helpers (persist)
========================= */

async function readIds(key: string): Promise<string[]> {
  const driver = pickDriver();

  if (driver === "redis") {
    const v = await redisGetJson<string[]>(key);
    return Array.isArray(v) ? v : [];
  }

  if (driver === "kv") {
    const { kv } = await import("@vercel/kv");
    const v = (await kv.get(key)) as string[] | null;
    return Array.isArray(v) ? v : [];
  }

  // memory 不走这里
  return [];
}

async function writeIds(key: string, ids: string[]): Promise<void> {
  const driver = pickDriver();

  if (driver === "redis") {
    await redisSetJson(key, ids);
    return;
  }

  if (driver === "kv") {
    const { kv } = await import("@vercel/kv");
    await kv.set(key, ids);
    return;
  }
}

async function addIdToIndex(key: string, id: string): Promise<void> {
  const ids = await readIds(key);
  if (!ids.includes(id)) {
    ids.push(id);
    await writeIds(key, ids);
  }
}

async function removeIdFromIndex(key: string, id: string): Promise<void> {
  const ids = await readIds(key);
  const next = ids.filter((x) => x !== id);
  if (next.length !== ids.length) {
    await writeIds(key, next);
  }
}

/* =========================
   Persist ops
========================= */

async function getMissionPersist(id: string): Promise<Mission | null> {
  const driver = pickDriver();

  if (driver === "redis") {
    const v = await redisGetJson<Mission>(keyMission(id));
    return v ?? null;
  }

  if (driver === "kv") {
    const { kv } = await import("@vercel/kv");
    return ((await kv.get(keyMission(id))) as Mission | null) ?? null;
  }

  return null;
}

async function saveMissionPersist(m: Mission): Promise<void> {
  const driver = pickDriver();

  if (driver === "redis") {
    await redisSetJson(keyMission(m.id), m);
    await addIdToIndex(KEY_ALL_IDS, m.id);
    await addIdToIndex(keyProjectIndex(m.projectId), m.id);
    return;
  }

  if (driver === "kv") {
    const { kv } = await import("@vercel/kv");
    await kv.set(keyMission(m.id), m);
    await addIdToIndex(KEY_ALL_IDS, m.id);
    await addIdToIndex(keyProjectIndex(m.projectId), m.id);
    return;
  }
}

/* =========================
   Public API (unchanged)
========================= */

export async function listMissions(params?: {
  projectId?: string;
  activeOnly?: boolean;
}): Promise<Mission[]> {
  const driver = pickDriver();
  const { projectId, activeOnly } = params || {};

  // ---------- memory ----------
  if (driver === "memory") {
    const db = getMemDB();

    let ids: string[];
    if (projectId) {
      const set = db.missionsByProject.get(projectId);
      ids = set ? Array.from(set.values()) : [];
    } else {
      ids = Array.from(db.missions.keys());
    }

    const arr = ids
      .map((id) => db.missions.get(id))
      .filter(Boolean) as Mission[];

    const filtered = activeOnly ? arr.filter((m) => m.active) : arr;
    filtered.sort((a, b) => b.createdAt - a.createdAt);
    return filtered;
  }

  // ---------- persist (redis/kv) ----------
  let ids: string[] = [];
  if (projectId) {
    ids = await readIds(keyProjectIndex(projectId));
  } else {
    ids = await readIds(KEY_ALL_IDS);
  }

  if (!ids.length) return [];

  const items = await Promise.all(ids.map((id) => getMissionPersist(id)));
  const arr = items.filter((v): v is Mission => !!v);

  const filtered = activeOnly ? arr.filter((m) => m.active) : arr;
  filtered.sort((a, b) => b.createdAt - a.createdAt);
  return filtered;
}

export async function createMission(input: CreateMissionInput): Promise<Mission> {
  const t = now();
  const id = makeId("mis");

  const m: Mission = {
    id,
    projectId: input.projectId,
    title: input.title,
    description: input.description ? String(input.description) : undefined,
    proofType: "SIGN_MESSAGE",
    weight: Number(input.weight),
    active: Boolean(input.active),
    createdAt: t,
    updatedAt: t,
  };

  const driver = pickDriver();

  // memory
  if (driver === "memory") {
    const db = getMemDB();
    db.missions.set(id, m);

    if (!db.missionsByProject.has(m.projectId)) {
      db.missionsByProject.set(m.projectId, new Set());
    }
    db.missionsByProject.get(m.projectId)!.add(id);
    return m;
  }

  // persist
  await saveMissionPersist(m);
  return m;
}

export async function getMissionById(id: string): Promise<Mission | null> {
  const driver = pickDriver();

  if (driver === "memory") {
    const db = getMemDB();
    return db.missions.get(id) || null;
  }

  return await getMissionPersist(id);
}

export async function setMissionActive(
  id: string,
  active: boolean
): Promise<Mission | null> {
  const driver = pickDriver();

  // memory
  if (driver === "memory") {
    const db = getMemDB();
    const m = db.missions.get(id);
    if (!m) return null;
    const next: Mission = { ...m, active, updatedAt: now() };
    db.missions.set(id, next);
    return next;
  }

  // persist
  const current = await getMissionPersist(id);
  if (!current) return null;

  const next: Mission = { ...current, active, updatedAt: now() };

  // 保存 item（索引不变）
  if (driver === "redis") {
    await redisSetJson(keyMission(id), next);
    return next;
  }

  const { kv } = await import("@vercel/kv");
  await kv.set(keyMission(id), next);
  return next;
}
