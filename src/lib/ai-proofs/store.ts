import type { AiAssessment, AiProofDraft, AiVisibility } from "./types";
import { AI_PROOF_INDEX_KEY, aiProofKey } from "./keys";
import { memGet, memSet, memDel } from "./driver-memory";
import { kvGet, kvSet, kvDel } from "./driver-kv";

type Driver = "memory" | "kv";

function pickDriver(): Driver {
  const v = String(process.env.AI_PROOFS_STORE_DRIVER || "memory").toLowerCase();
  return v === "kv" ? "kv" : "memory";
}

async function get(key: string) {
  return pickDriver() === "kv" ? kvGet(key) : memGet(key);
}
async function set(key: string, val: any) {
  return pickDriver() === "kv" ? kvSet(key, val) : memSet(key, val);
}
async function del(key: string) {
  return pickDriver() === "kv" ? kvDel(key) : memDel(key);
}

function genId() {
  return "aid_" + Math.random().toString(36).slice(2, 14);
}

async function readIndex(): Promise<string[]> {
  const ids = await get(AI_PROOF_INDEX_KEY);
  return Array.isArray(ids) ? ids : [];
}

async function writeIndex(ids: string[]) {
  // 去重 + 保持顺序（新在前）
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  await set(AI_PROOF_INDEX_KEY, out);
}

export async function saveAiDraft(d: AiProofDraft) {
  await set(aiProofKey(d.id), d);
  // index 新在前
  const ids = await readIndex();
  await writeIndex([d.id, ...ids]);
  return d;
}

export async function getAiDraftById(id: string): Promise<AiProofDraft | null> {
  const v = await get(aiProofKey(id));
  return v && typeof v === "object" ? (v as AiProofDraft) : null;
}

export async function listAiDrafts(): Promise<AiProofDraft[]> {
  const ids = await readIndex();
  const out: AiProofDraft[] = [];
  for (const id of ids) {
    const d = await getAiDraftById(id);
    if (d) out.push(d);
  }
  return out;
}

export async function deleteAiDraft(id: string) {
  await del(aiProofKey(id));
  const ids = await readIndex();
  await writeIndex(ids.filter((x) => x !== id));
}

export async function createAiDraftFromAssessment(args: { assessment: any }) {
  // 兼容多种输入形态
  // 1) { assessment: {...} }
  // 2) { assessment: { assessment: {...} } }  (某些地方可能套娃)
  // 3) 直接把 assessment 当 args 传进来（兜底）
  const input0: any = (args as any)?.assessment ?? args ?? {};
  const a: any = input0?.assessment ?? input0 ?? {};

  // ---- 基础字段：永远以 assessment 为主 ----
  const type = typeof a?.type === "string" && a.type.trim() ? a.type.trim().toUpperCase() : "OTHER";
  const title = typeof a?.title === "string" && a.title.trim() ? a.title.trim() : "Untitled";
  const summary = typeof a?.summary === "string" ? a.summary.trim() : "";

  // ---- 强制枚举合法值 ----
  const verifiability =
    a?.verifiability === "HIGH" || a?.verifiability === "MEDIUM" || a?.verifiability === "LOW"
      ? a.verifiability
      : "LOW";

  const suggestedVisibility =
    a?.suggestedVisibility === "PUBLIC" || a?.suggestedVisibility === "PRIVATE"
      ? a.suggestedVisibility
      : "PRIVATE";

  const repeatable = typeof a?.repeatable === "boolean" ? a.repeatable : false;

  const tags = Array.isArray(a?.tags)
    ? a.tags.filter((x: any) => typeof x === "string").map((s: string) => s.trim()).filter(Boolean).slice(0, 5)
    : [];

  const followups = Array.isArray(a?.followups)
    ? a.followups
        .filter((x: any) => x && typeof x === "object")
        .slice(0, 2)
        .map((x: any) => ({
          question: String(x.question ?? "").trim(),
          reason: x.reason != null ? String(x.reason).trim() : undefined,
        }))
        .filter((x: any) => x.question)
    : [];

  // ---- 标准化 assessment ----
  const normalizedAssessment = {
    ok: a?.ok ?? true,
    type,
    title,
    summary,
    verifiability,
    repeatable,
    suggestedVisibility,
    tags,
    followups,
  };

  // ---- payload：由 assessment 生成（不反向覆盖 assessment）----
  const normalizedPayload = {
    type,
    title,
    description: summary,
    timeISO: new Date().toISOString(),
    links: Array.isArray(a?.links)
      ? a.links.filter((x: any) => typeof x === "string").map((s: string) => s.trim()).filter(Boolean)
      : [],
    tags,
    visibility: suggestedVisibility,
    verifiability,
    repeatable,
  };

  const now = Date.now();
  const draft: any = {
    id: genId(), // 你文件里已经有 genId() 就用它
    createdAt: now,
    updatedAt: now,
    assessment: normalizedAssessment,
    payload: normalizedPayload,
    status: "DRAFT",
  };

  await saveAiDraft(draft);
  return draft;
}


export async function updateAiDraftEditFields(args: {
  id: string;
  links?: string[];
  visibility?: AiVisibility;
}) {
  const d = await getAiDraftById(args.id);
  if (!d) return null;

  if (d.status !== "DRAFT") {
    // 已提交的不允许再编辑
    return { ok: false, error: "LOCKED" as const };
  }

  const links =
    args.links?.filter((x) => typeof x === "string").map((s) => s.trim()).filter(Boolean) ??
    d.payload.links;

  const visibility = (args.visibility ?? d.payload.visibility) as AiVisibility;

  d.updatedAt = Date.now();
  d.payload.links = links;
  d.payload.visibility = visibility;

  // 同步到 assessment（如果你希望：用户改了可见性，就覆盖建议值）
  d.assessment.suggestedVisibility = visibility;

  await saveAiDraft(d);
  return { ok: true, draft: d };
}

export async function submitAiDraft(id: string) {
  const d = await getAiDraftById(id);
  if (!d) return null;

  if (d.status !== "DRAFT") {
    return { ok: false, error: "ALREADY_SUBMITTED" as const, draft: d };
  }

  d.updatedAt = Date.now();
  d.status = "SUBMITTED";
  await saveAiDraft(d);

  return { ok: true, draft: d };
}

export async function saveAiSignature(args: {
  id: string;
  wallet?: string;
  chain?: "solana" | "evm";
  signature?: string;
}) {
  const d = await getAiDraftById(args.id);
  if (!d) return null;

  // 签名不改变 status，你现在页面也写了 stub
  d.updatedAt = Date.now();
  if (args.wallet != null) d.wallet = args.wallet;
  if (args.chain != null) d.chain = args.chain;
  if (args.signature != null) d.signature = args.signature;

  await saveAiDraft(d);
  return { ok: true, draft: d };
}
export async function saveAiSignMessage(args: {
  id: string;
  wallet?: string;
  chain?: "solana" | "evm";
  signMessage: string;
}) {
  const d = await getAiDraftById(args.id);
  if (!d) return null;

  // 允许 DRAFT 阶段生成 message
  d.updatedAt = Date.now();
  (d as any).signMessage = String(args.signMessage || "");

  if (args.wallet != null) (d as any).wallet = args.wallet;
  if (args.chain != null) (d as any).chain = args.chain;

  await saveAiDraft(d);
  return { ok: true, draft: d, signMessage: (d as any).signMessage };
}
