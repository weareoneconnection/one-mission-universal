// apps/web/src/lib/server/chainProofStore.ts
import "server-only";
import { getRedis } from "@/lib/server/redis";

export type ChainStatus = "QUEUED" | "SUBMITTED" | "FINALIZED" | "FAILED";

export type ChainQueueItem = {
  proofId: string;
  userWallet: string;
  chainStatus: ChainStatus;
  chainTx?: string;
  lastError?: string;
  createdAt: number;
  updatedAt: number;
};

type Driver = "memory" | "kv";
function pickDriver(): Driver {
  const v = String(process.env.MISSION_STORE_DRIVER || "memory").toLowerCase();
  return v === "kv" ? "kv" : "memory";
}

// ---- memory db (dev) ----
type MemDB = { items: Map<string, ChainQueueItem> };
function getMemDB(): MemDB {
  const g = globalThis as any;
  if (!g.__OM_CHAIN_PROOF_STORE__) {
    g.__OM_CHAIN_PROOF_STORE__ = { items: new Map() };
  }
  return g.__OM_CHAIN_PROOF_STORE__ as MemDB;
}

const KEY_PREFIX = "om:chain:item:v1:";
const keyItem = (proofId: string) => `${KEY_PREFIX}${proofId}`;

function safeJsonParse<T>(s: any): T | null {
  if (typeof s !== "string") return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

export async function getChainQueueItem(proofId: string): Promise<ChainQueueItem | null> {
  const id = String(proofId || "").trim();
  if (!id) return null;

  const driver = pickDriver();
  if (driver === "memory") {
    return getMemDB().items.get(id) || null;
  }

  const r = await getRedis();
  const v = await r.get(keyItem(id));
  return safeJsonParse<ChainQueueItem>(v);
}

export async function updateChainQueueItem(
  proofId: string,
  patch: Partial<Omit<ChainQueueItem, "proofId">> & { userWallet?: string }
): Promise<ChainQueueItem> {
  const id = String(proofId || "").trim();
  if (!id) throw new Error("MISSING_PROOF_ID");

  const now = Date.now();
  const driver = pickDriver();

  if (driver === "memory") {
    const db = getMemDB();
    const prev = db.items.get(id);
    const next: ChainQueueItem = {
      proofId: id,
      userWallet: String(patch.userWallet ?? prev?.userWallet ?? "").trim(),
      chainStatus: (patch.chainStatus ?? prev?.chainStatus ?? "QUEUED") as ChainStatus,
      chainTx: patch.chainTx ?? prev?.chainTx,
      lastError: patch.lastError ?? prev?.lastError,
      createdAt: prev?.createdAt ?? now,
      updatedAt: patch.updatedAt ?? now,
    };
    db.items.set(id, next);
    return next;
  }

  const r = await getRedis();
  const prevRaw = await r.get(keyItem(id));
  const prev = safeJsonParse<ChainQueueItem>(prevRaw);

  const next: ChainQueueItem = {
    proofId: id,
    userWallet: String(patch.userWallet ?? prev?.userWallet ?? "").trim(),
    chainStatus: (patch.chainStatus ?? prev?.chainStatus ?? "QUEUED") as ChainStatus,
    chainTx: patch.chainTx ?? prev?.chainTx,
    lastError: patch.lastError ?? prev?.lastError,
    createdAt: prev?.createdAt ?? now,
    updatedAt: patch.updatedAt ?? now,
  };

  await r.set(keyItem(id), JSON.stringify(next));
  return next;
}

/**
 * ✅ FIX for build:
 * aggregate.ts expects this export.
 * List chain queue items by status.
 */
export async function listChainQueueByStatus(
  status: ChainStatus
): Promise<ChainQueueItem[]> {
  const driver = pickDriver();

  if (driver === "memory") {
    const all = Array.from(getMemDB().items.values());
    return all.filter((it) => it.chainStatus === status);
  }

  const r = await getRedis();
  const rr: any = r as any;

  // Some redis clients (e.g., Upstash) may not support KEYS in certain modes.
  if (typeof rr.keys !== "function") {
    // Fallback: cannot enumerate keys, return empty list (keeps build/runtime safe)
    return [];
  }

  const keys: string[] = await rr.keys(`${KEY_PREFIX}*`);
  if (!Array.isArray(keys) || keys.length === 0) return [];

  const out: ChainQueueItem[] = [];

  // safest: do sequential gets (avoid pipeline incompat issues)
  for (const k of keys) {
    const raw = await r.get(k);
    const item = safeJsonParse<ChainQueueItem>(raw);
    if (!item) continue;
    if (item.chainStatus === status) out.push(item);
  }

  // optional: newest first
  out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return out;
}
