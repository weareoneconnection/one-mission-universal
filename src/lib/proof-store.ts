// apps/web/src/lib/proof-store.ts
import "server-only";
import { getRedis } from "@/lib/server/redis";
import type { Proof, ProofEvent } from "@/lib/types";
import { nanoid } from "nanoid";

type Driver = "memory" | "redis" | "kv";

function pickDriver(): Driver {
  const v = String(process.env.PROOF_STORE_DRIVER || process.env.MISSION_STORE_DRIVER || "memory")
    .toLowerCase()
    .trim();

  if (v === "redis") return "redis";
  if (v === "kv") return "kv";
  return "memory";
}

/* =========================
   memory db (dev fallback)
========================= */

type MemDB = {
  proofs: Map<string, Proof>;
  byWallet: Map<string, string[]>; // wallet -> proofIds
  index: string[]; // all proofIds
};

function getMemDB(): MemDB {
  const g = globalThis as any;
  if (!g.__OMU_PROOF_MEMDB__) {
    g.__OMU_PROOF_MEMDB__ = { proofs: new Map(), byWallet: new Map(), index: [] };
  }
  return g.__OMU_PROOF_MEMDB__ as MemDB;
}

/* =========================
   keys
========================= */

const KEY_INDEX = "om:proofs:index:v1"; // string[]
const keyProof = (id: string) => `om:proofs:item:${id}`;
const keyByWallet = (wallet: string) => `om:proofs:byWallet:${wallet}`; // string[]

/* =========================
   helpers
========================= */

function safeArray(v: any): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String);

  // Upstash/Redis REST 可能返回 string (JSON)
  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function uniqPush(arr: string[], id: string) {
  if (!arr.includes(id)) arr.push(id);
  return arr;
}

async function readIds(key: string): Promise<string[]> {
  const driver = pickDriver();

  if (driver === "memory") return [];

  if (driver === "redis") {
    const r = await getRedis();
    const v = await r.get(key);
    return safeArray(v);
  }

  const { kv } = await import("@vercel/kv");
  const v = await kv.get(key);
  return safeArray(v);
}

async function writeIds(key: string, ids: string[]): Promise<void> {
  const driver = pickDriver();

  if (driver === "memory") return;

  if (driver === "redis") {
    const r = await getRedis();
    // 为了兼容 Upstash REST，把数组存成 JSON string 最稳
    await r.set(key, JSON.stringify(ids));
    return;
  }

  const { kv } = await import("@vercel/kv");
  await kv.set(key, ids);
}

async function addToIndex(id: string): Promise<void> {
  const driver = pickDriver();
  if (driver === "memory") return;

  const ids = await readIds(KEY_INDEX);
  if (!ids.includes(id)) {
    ids.push(id);
    await writeIds(KEY_INDEX, ids);
  }
}

async function addToWalletIndex(wallet: string, id: string): Promise<void> {
  const driver = pickDriver();
  if (driver === "memory") return;

  const w = String(wallet || "").trim();
  if (!w) return;

  const key = keyByWallet(w);
  const ids = await readIds(key);
  if (!ids.includes(id)) {
    ids.push(id);
    await writeIds(key, ids);
  }
}

async function getProofPersist(id: string): Promise<Proof | null> {
  const driver = pickDriver();

  if (driver === "redis") {
    const r = await getRedis();
    const v = await r.get(keyProof(id));
    if (!v) return null;
    if (typeof v === "string") {
      try {
        return JSON.parse(v) as Proof;
      } catch {
        return null;
      }
    }
    return (v as Proof) ?? null;
  }

  if (driver === "kv") {
    const { kv } = await import("@vercel/kv");
    return ((await kv.get(keyProof(id))) as Proof | null) ?? null;
  }

  return null;
}

async function saveProofPersist(p: Proof): Promise<void> {
  const driver = pickDriver();

  if (driver === "redis") {
    const r = await getRedis();
    // 同样：存 JSON string 最稳
    await r.set(keyProof(p.id), JSON.stringify(p));

    // ✅ 关键：无论如何都要维护两个索引
    await addToIndex(p.id);
    await addToWalletIndex(p.userWallet, p.id);
    return;
  }

  if (driver === "kv") {
    const { kv } = await import("@vercel/kv");
    await kv.set(keyProof(p.id), p);
    await addToIndex(p.id);
    await addToWalletIndex(p.userWallet, p.id);
    return;
  }
}

/* =========================
   Public API
========================= */

export async function getProofById(id: string): Promise<Proof | null> {
  const pid = String(id || "").trim();
  if (!pid) return null;

  const driver = pickDriver();

  if (driver === "memory") {
    const db = getMemDB();
    return db.proofs.get(pid) || null;
  }

  return await getProofPersist(pid);
}

export async function saveProof(p: Proof): Promise<void> {
  const driver = pickDriver();

  if (driver === "memory") {
    const db = getMemDB();
    db.proofs.set(p.id, p);

    uniqPush(db.index, p.id);

    const w = String(p.userWallet || "").trim();
    if (w) {
      const arr = db.byWallet.get(w) || [];
      uniqPush(arr, p.id);
      db.byWallet.set(w, arr);
    }
    return;
  }

  await saveProofPersist(p);
}

export async function listProofsByWallet(wallet: string): Promise<Proof[]> {
  const w = String(wallet || "").trim();
  if (!w) return [];

  const driver = pickDriver();

  if (driver === "memory") {
    const db = getMemDB();
    const ids = db.byWallet.get(w) || [];
    const arr = ids.map((id) => db.proofs.get(id)).filter(Boolean) as Proof[];
    arr.sort((a, b) => Number(b.updatedAt ?? b.createdAt ?? 0) - Number(a.updatedAt ?? a.createdAt ?? 0));
    return arr;
  }

  const ids = await readIds(keyByWallet(w));
  if (!ids.length) return [];

  const items = await Promise.all(ids.map((id) => getProofPersist(id)));
  const arr = items.filter((v): v is Proof => !!v);
  arr.sort((a, b) => Number(b.updatedAt ?? b.createdAt ?? 0) - Number(a.updatedAt ?? a.createdAt ?? 0));
  return arr;
}

// backward compat
export async function listProofsByUser(wallet: string): Promise<Proof[]> {
  return listProofsByWallet(wallet);
}

export async function listProofs(params?: {
  limit?: number;
  wallet?: string;
  projectId?: string;
  missionId?: string;
  status?: Proof["currentStatus"];
}): Promise<Proof[]> {
  const limit = Math.max(1, Math.min(Number(params?.limit || 50), 200));
  const wallet = String(params?.wallet || "").trim();
  const projectId = String(params?.projectId || "").trim();
  const missionId = String(params?.missionId || "").trim();
  const status = params?.status;

  // wallet scope fast path
  if (wallet) {
    let arr = await listProofsByWallet(wallet);
    if (projectId) arr = arr.filter((p) => p.projectId === projectId);
    if (missionId) arr = arr.filter((p) => p.missionId === missionId);
    if (status) arr = arr.filter((p) => p.currentStatus === status);
    return arr.slice(0, limit);
  }

  const driver = pickDriver();

  if (driver === "memory") {
    const db = getMemDB();
    let out = db.index.map((id) => db.proofs.get(id)).filter(Boolean) as Proof[];

    if (projectId) out = out.filter((p) => p.projectId === projectId);
    if (missionId) out = out.filter((p) => p.missionId === missionId);
    if (status) out = out.filter((p) => p.currentStatus === status);

    out.sort((a, b) => Number(b.updatedAt ?? b.createdAt ?? 0) - Number(a.updatedAt ?? a.createdAt ?? 0));
    return out.slice(0, limit);
  }

  const ids = await readIds(KEY_INDEX);
  if (!ids.length) return [];

  const items = await Promise.all(ids.map((id) => getProofPersist(id)));
  let out = items.filter((v): v is Proof => !!v);

  if (projectId) out = out.filter((p) => p.projectId === projectId);
  if (missionId) out = out.filter((p) => p.missionId === missionId);
  if (status) out = out.filter((p) => p.currentStatus === status);

  out.sort((a, b) => Number(b.updatedAt ?? b.createdAt ?? 0) - Number(a.updatedAt ?? a.createdAt ?? 0));
  return out.slice(0, limit);
}

export function summarizeProofs(proofs: Proof[]) {
  const arr = Array.isArray(proofs) ? proofs : [];

  const totalProofs = arr.length;
  const pending = arr.filter((p) => p.currentStatus === "PENDING").length;
  const approved = arr.filter((p) => p.currentStatus === "APPROVED").length;
  const rejected = arr.filter((p) => p.currentStatus === "REJECTED").length;
  const revoked = arr.filter((p) => p.currentStatus === "REVOKED").length;

  const totalPoints = arr.reduce(
    (sum, p) => sum + (p.currentStatus === "APPROVED" ? Number((p as any).points ?? 0) : 0),
    0
  );

  const totalReputation = arr.reduce(
    (sum, p) => sum + (p.currentStatus !== "PENDING" ? Number((p as any).reputationDelta ?? 0) : 0),
    0
  );

  return {
    totalProofs,
    pending,
    approved,
    rejected,
    revoked,
    totalPoints,
    totalReputation,
  };
}

/* =========================
   Backward-compatible exports
   used by /api/projects/[projectId]/proofs/route.ts
========================= */

export async function listProofsByProject(projectId: string): Promise<Proof[]> {
  const pid = String(projectId || "").trim();
  if (!pid) return [];
  return listProofs({ projectId: pid, limit: 200 });
}

export async function listProofsByProjectAndStatus(
  projectId: string,
  status: Proof["currentStatus"]
): Promise<Proof[]> {
  const pid = String(projectId || "").trim();
  if (!pid) return [];
  if (!status) return listProofsByProject(pid);
  return listProofs({ projectId: pid, status, limit: 200 });
}

export function createProof(input: {
  projectId: string;
  missionId: string;
  userWallet: string;
  signature: string;
  message: string;
  payload?: any;
}): Proof {
  const now = Date.now();

  const p: Proof = {
    id: `prf_${nanoid(16)}`,
    projectId: String(input.projectId || "").trim(),
    missionId: String(input.missionId || "").trim(),
    userWallet: String(input.userWallet || "").trim(),
    signature: String(input.signature || "").trim(),
    message: String(input.message || ""),
    createdAt: now,
    updatedAt: now,
    currentStatus: "PENDING",
    events: [
      {
        id: `evt_${nanoid(10)}`,
        type: "SUBMITTED",
        at: now,
        by: String(input.userWallet || "").trim(),
        payload: input.payload,
      } as ProofEvent,
    ],
    points: 0,
    reputationDelta: 0,
    payload: input.payload,
  };

  return p;
}
