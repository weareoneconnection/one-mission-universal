// apps/web/src/lib/projects/store.ts
import type { Project } from "./types";
import type { CreateProjectInput } from "./validators";
import { getRedis } from "@/lib/server/redis";

type MemDB = {
  projects: Map<string, Project>;
  projectsBySlug: Map<string, string>;
};

function getMemDB(): MemDB {
  const g = globalThis as unknown as { __OMU_MEMDB__?: MemDB };
  if (!g.__OMU_MEMDB__) {
    g.__OMU_MEMDB__ = {
      projects: new Map(),
      projectsBySlug: new Map(),
    };
  }
  return g.__OMU_MEMDB__;
}

function now() {
  return Date.now();
}

function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}${Math.random()
    .toString(16)
    .slice(2)}`.slice(0, 22);
}

function slugify(input: string) {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "project"
  );
}

function ensureUniqueSlug(slug: string, used: (s: string) => boolean) {
  if (!used(slug)) return slug;
  for (let i = 2; i < 9999; i++) {
    const cand = `${slug}-${i}`;
    if (!used(cand)) return cand;
  }
  return `${slug}-${Date.now()}`;
}

/* =========================
   Driver (persist)
========================= */

type Driver = "memory" | "redis" | "kv";

function pickDriver(): Driver {
  const v = String(
    process.env.PROJECT_STORE_DRIVER || process.env.MISSION_STORE_DRIVER || "memory"
  )
    .toLowerCase()
    .trim();

  if (v === "redis") return "redis";
  if (v === "kv") return "kv";
  return "memory";
}

/* =========================
   Keys
========================= */

const KEY_INDEX = "om:projects:index:v1"; // string[] of project ids
const keyProject = (id: string) => `om:projects:item:${id}`;
const keySlug = (slug: string) => `om:projects:slug:${slug}`; // slug -> id

/* =========================
   Redis JSON helpers
========================= */

async function redisGetJson<T>(key: string): Promise<T | null> {
  const r: any = await getRedis();
  const v = await r.get(key);

  if (v == null) return null;

  // 兼容：某些封装可能直接返回对象
  if (typeof v !== "string") return v as T;

  try {
    return JSON.parse(v) as T;
  } catch {
    // 兼容历史脏数据（比如 "[object Object]"），避免直接炸
    return null;
  }
}

async function redisSetJson(key: string, value: any) {
  const r: any = await getRedis();
  const s = typeof value === "string" ? value : JSON.stringify(value);
  await r.set(key, s);
}

/* =========================
   Index ops
========================= */

async function readIndexIds(): Promise<string[]> {
  const driver = pickDriver();

  if (driver === "memory") {
    const db = getMemDB();
    return Array.from(db.projects.keys());
  }

  if (driver === "redis") {
    const ids = await redisGetJson<string[]>(KEY_INDEX);
    return Array.isArray(ids) ? ids : [];
  }

  const { kv } = await import("@vercel/kv");
  const ids = (await kv.get(KEY_INDEX)) as string[] | null;
  return Array.isArray(ids) ? ids : [];
}

async function writeIndexIds(ids: string[]) {
  const driver = pickDriver();

  if (driver === "memory") return; // memory 用 map keys 即可

  if (driver === "redis") {
    await redisSetJson(KEY_INDEX, ids);
    return;
  }

  const { kv } = await import("@vercel/kv");
  await kv.set(KEY_INDEX, ids);
}

async function addIndexId(id: string) {
  const driver = pickDriver();
  if (driver === "memory") return;

  const ids = await readIndexIds();
  if (!ids.includes(id)) {
    ids.push(id);
    await writeIndexIds(ids);
  }
}

/* =========================
   Slug ops
========================= */

async function usedSlug(slug: string): Promise<boolean> {
  const driver = pickDriver();

  if (driver === "memory") {
    const db = getMemDB();
    return db.projectsBySlug.has(slug);
  }

  if (driver === "redis") {
    // slug->id 存的是 string（也可能被 json 包了一层），两种都兼容
    const v = await redisGetJson<string>(keySlug(slug));
    return !!v;
  }

  const { kv } = await import("@vercel/kv");
  const v = await kv.get(keySlug(slug));
  return !!v;
}

/* =========================
   Persist ops
========================= */

async function saveProjectPersist(p: Project) {
  const driver = pickDriver();

  if (driver === "memory") {
    const db = getMemDB();
    db.projects.set(p.id, p);
    db.projectsBySlug.set(p.slug, p.id);
    return;
  }

  if (driver === "redis") {
    await redisSetJson(keyProject(p.id), p);
    // slug -> id（存纯 string 或 json string 都行，这里用 json helper 统一）
    await redisSetJson(keySlug(p.slug), p.id);
    await addIndexId(p.id);
    return;
  }

  const { kv } = await import("@vercel/kv");
  await kv.set(keyProject(p.id), p);
  await kv.set(keySlug(p.slug), p.id);
  await addIndexId(p.id);
}

async function getProjectPersist(id: string): Promise<Project | null> {
  const driver = pickDriver();

  if (driver === "memory") {
    const db = getMemDB();
    return db.projects.get(id) || null;
  }

  if (driver === "redis") {
    const p = await redisGetJson<Project>(keyProject(id));
    return p ?? null;
  }

  const { kv } = await import("@vercel/kv");
  return ((await kv.get(keyProject(id))) as Project | null) ?? null;
}

async function getIdBySlugPersist(slug: string): Promise<string | null> {
  const driver = pickDriver();

  if (driver === "memory") {
    const db = getMemDB();
    return db.projectsBySlug.get(slug) || null;
  }

  if (driver === "redis") {
    const v = await redisGetJson<string>(keySlug(slug));
    return v ? String(v) : null;
  }

  const { kv } = await import("@vercel/kv");
  const v = await kv.get(keySlug(slug));
  return v ? String(v) : null;
}

/* =========================
   Public API (unchanged)
========================= */

export async function listProjects(): Promise<Project[]> {
  const driver = pickDriver();

  if (driver === "memory") {
    const db = getMemDB();
    const arr = Array.from(db.projects.values());
    arr.sort((a, b) => b.createdAt - a.createdAt);
    return arr;
  }

  const ids = await readIndexIds();
  const items = await Promise.all(ids.map((id) => getProjectPersist(id)));
  const arr = items.filter((v): v is Project => !!v);
  arr.sort((a, b) => b.createdAt - a.createdAt);
  return arr;
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const t = now();

  const baseSlug = slugify(input.name);
  const slug = ensureUniqueSlug(baseSlug, (s) => {
    // NOTE: ensureUniqueSlug expects sync predicate, but we need async now.
    // So we keep it sync for memory only; for persist we do a small loop below.
    return false;
  });

  // ✅ async unique slug (persist + memory 都能用)
  let finalSlug = slugify(input.name);
  if (await usedSlug(finalSlug)) {
    for (let i = 2; i < 9999; i++) {
      const cand = `${finalSlug}-${i}`;
      if (!(await usedSlug(cand))) {
        finalSlug = cand;
        break;
      }
    }
    if (await usedSlug(finalSlug)) {
      finalSlug = `${finalSlug}-${Date.now()}`;
    }
  }

  const id = makeId("proj");

  const p: Project = {
    id,
    name: input.name,
    slug: finalSlug,
    website: input.website ? String(input.website) : undefined,
    chain: "solana",
    ownerWallet: input.ownerWallet,
    createdAt: t,
    updatedAt: t,
  };

  await saveProjectPersist(p);
  return p;
}

export async function getProjectById(id: string): Promise<Project | null> {
  return await getProjectPersist(id);
}

export async function getProjectBySlug(slug: string): Promise<Project | null> {
  const s = String(slug || "").trim();
  if (!s) return null;
  const id = await getIdBySlugPersist(s);
  if (!id) return null;
  return await getProjectPersist(id);
}
