// apps/web/src/lib/client/aiProofs.ts

type JsonAny = any;

async function readJsonSafe(r: Response) {
  const ct = r.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return await r.json().catch(() => ({}));
  }
  return {
    ok: false,
    error: "NON_JSON_RESPONSE",
    status: r.status,
    raw: await r.text().catch(() => ""),
  };
}

function httpFail(r: Response, data: any) {
  return { ok: false, error: data?.error || `HTTP_${r.status}`, status: r.status, ...data };
}

/**
 * ✅ Create draft from assessment
 * Compatible calls:
 * 1) createDraft({ assessment })
 * 2) createDraft(assessment)
 */
export async function createDraft(input: any) {
  const assessment = input?.assessment ?? input ?? null;

  const r = await fetch("/api/ai-proofs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ assessment }),
  });

  const data: any = await readJsonSafe(r);
  if (!r.ok) return httpFail(r, data);
  return data;
}

/**
 * ✅ List drafts
 * Optional filter: { status?: "DRAFT" | "SUBMITTED" }
 */
export async function listDrafts(opts?: { status?: string }) {
  const q = opts?.status ? `?status=${encodeURIComponent(opts.status)}` : "";
  const r = await fetch(`/api/ai-proofs${q}`, {
    method: "GET",
    cache: "no-store",
  });

  const data: any = await readJsonSafe(r);
  if (!r.ok) return httpFail(r, data);
  return data;
}

/**
 * ✅ Get single draft by id
 */
export async function getDraft(id: string) {
  const r = await fetch(`/api/ai-proofs/${encodeURIComponent(id)}`, {
    method: "GET",
    cache: "no-store",
  });

  const data: any = await readJsonSafe(r);
  if (!r.ok) return httpFail(r, data);
  return data;
}

/**
 * ✅ Update draft editable fields (MVP)
 * UI can call:
 * updateDraft({ id, links, visibility })
 */
export async function updateDraft(input: { id: string; links?: string[]; visibility?: string }) {
  const id = String(input?.id || "");
  if (!id) return { ok: false, error: "MISSING_ID" };

  // Prefer PATCH /api/ai-proofs/[id]
  const tryPatch = async () => {
    const r = await fetch(`/api/ai-proofs/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({
        id,                 // ✅ 就是加这一行（双保险）
        action: "update",
        links: input.links,
        visibility: input.visibility,
      }),
    });

    const data: any = await readJsonSafe(r);
    if (!r.ok) return httpFail(r, data);
    return data;
  };

  const res1 = await tryPatch();
  if (res1?.ok) return res1;

  // Fallback: POST /api/ai-proofs/[id]
  const r = await fetch(`/api/ai-proofs/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      action: "update",
      links: input.links,
      visibility: input.visibility,
    }),
  });

  const data: any = await readJsonSafe(r);
  if (!r.ok) return httpFail(r, data);
  return data;
}

/**
 * ✅ Get signMessage (MVP)
 * Your repo里之前 grep 到有两种调用：
 * - GET /api/ai-proofs/[id]/sign?wallet=...
 * - POST /api/ai-proofs/[id]/sign
 *
 * 这里做 GET（生成 signMessage）：
 */
export async function getSignMessage(input: { id: string; wallet: string; chain?: "solana" | "evm" }) {
  const id = String(input?.id || "");
  const wallet = String(input?.wallet || "").trim();
  const chain = (input?.chain || "solana") as "solana" | "evm";
  if (!id) return { ok: false, error: "MISSING_ID" };
  if (!wallet) return { ok: false, error: "MISSING_WALLET" };

  const q = `?wallet=${encodeURIComponent(wallet)}&chain=${encodeURIComponent(chain)}`;
  const r = await fetch(`/api/ai-proofs/${encodeURIComponent(id)}/sign${q}`, {
    method: "GET",
    cache: "no-store",
  });

  const data: any = await readJsonSafe(r);
  if (!r.ok) return httpFail(r, data);
  return data;
}

/**
 * ✅ Save signature for an AI draft
 * POST /api/ai-proofs/[id]/sign
 */
export async function saveAiSignature(input: {
  id: string;
  wallet?: string;
  chain?: "solana" | "evm";
  signature?: string;
}) {
  const id = String(input?.id || "");
  if (!id) return { ok: false, error: "MISSING_ID" };

  const r = await fetch(`/api/ai-proofs/${encodeURIComponent(id)}/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      wallet: input.wallet,
      chain: input.chain,
      signature: input.signature,
    }),
  });

  const data: any = await readJsonSafe(r);
  if (!r.ok) return httpFail(r, data);
  return data;
}

/**
 * ✅ Submit an AI draft
 * POST /api/ai-proofs/[id]/submit
 * Compatible calls:
 * - submitAiDraft(id)
 * - submitAiDraft({ id })
 */
export async function submitAiDraft(idOrInput: any) {
  const id = typeof idOrInput === "string" ? idOrInput : String(idOrInput?.id || "");
  if (!id) return { ok: false, error: "MISSING_ID" };

  const r = await fetch(`/api/ai-proofs/${encodeURIComponent(id)}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({}),
  });

  const data: any = await readJsonSafe(r);
  if (!r.ok) return httpFail(r, data);
  return data;
}

/* -------------------------------------------------------
   ✅ 兼容别名（不改你组件结构时非常重要）
   你组件里之前用过 saveSignature / submitDraft 这些名字
------------------------------------------------------- */

export const saveSignature = saveAiSignature;
export const submitDraft = submitAiDraft;

// ✅ 你上面已经有一个 getSignMessage(GET /sign?...)
// 这里不要重复定义同名函数，否则会报 4 个 TS 错误

/**
 * ✅ Generate signMessage (MVP)
 * POST /api/ai-proofs/[id]/sign-message
 */
export async function getSignMessageV2(input: {
  id: string;
  wallet: string;
  chain?: "solana" | "evm";
}) {
  const id = String(input?.id || "");
  const wallet = String(input?.wallet || "").trim();
  const chain = (input?.chain || "solana") as "solana" | "evm";
  if (!id) return { ok: false, error: "MISSING_ID" };
  if (!wallet) return { ok: false, error: "MISSING_WALLET" };

  const r = await fetch(`/api/ai-proofs/${encodeURIComponent(id)}/sign-message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ wallet, chain }),
  });

  const data: any = await readJsonSafe(r);
  if (!r.ok) return httpFail(r, data);
  return data;
}

// ✅ 可选：如果你希望组件仍然 import { getSignMessage } 走 POST 版本
// 就把下面这行打开（会覆盖上面的 GET 版本名）
// export const getSignMessage = getSignMessageV2;

