// apps/web/src/app/api/ai-proofs/[id]/route.ts
import { NextResponse } from "next/server";
import { getAiDraftById, updateAiDraftEditFields } from "@/lib/ai-proofs/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeTrim(v: any) {
  return String(v ?? "").trim();
}

function safeUpper(v: any) {
  const s = safeTrim(v);
  return s ? s.toUpperCase() : "";
}

function safeLinks(v: any): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out = v
    .filter((x) => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean);
  return out.length ? out : [];
}

/**
 * ✅ 更稳的 id 解析：
 * 1) ctx.params.id
 * 2) body.id（兼容前端 fallback/不同调用）
 * 3) URL path 兜底
 */
function getId(req: Request, ctx: any, body?: any) {
  const fromParams = safeTrim(ctx?.params?.id);
  if (fromParams) return fromParams;

  const fromBody = safeTrim(body?.id);
  if (fromBody) return fromBody;

  try {
    const pathname = new URL(req.url).pathname; // /api/ai-proofs/aid_xxx
    const seg = pathname.split("/").filter(Boolean).pop();
    return safeTrim(seg);
  } catch {
    return "";
  }
}

/**
 * GET /api/ai-proofs/:id
 */
export async function GET(req: Request, ctx: any) {
  const id = getId(req, ctx);
  if (!id) return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });

  const draft = await getAiDraftById(id);
  if (!draft) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  return NextResponse.json({ ok: true, draft });
}

/**
 * PATCH /api/ai-proofs/:id
 * body: { links?: string[], visibility?: "PUBLIC"|"PRIVATE" }
 */
export async function PATCH(req: Request, ctx: any) {
  const body = await req.json().catch(() => ({}));
  const id = getId(req, ctx, body);
  if (!id) return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });

  const links = safeLinks(body?.links);
  const visibility = safeUpper(body?.visibility) || undefined;

  const res = await updateAiDraftEditFields({
    id,
    links,
    visibility: visibility as any,
  });

  if (!res) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if ((res as any)?.ok === false) return NextResponse.json(res, { status: 403 });

  return NextResponse.json({ ok: true, draft: (res as any).draft ?? res });
}

/**
 * POST /api/ai-proofs/:id
 * 兼容前端 fallback：{ action:"update", links, visibility, id? }
 *
 * ✅ 同时兼容：
 * - 没有 action 但直接带 links/visibility（更鲁棒）
 */
export async function POST(req: Request, ctx: any) {
  const body = await req.json().catch(() => ({}));
  const id = getId(req, ctx, body);
  if (!id) return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });

  const action = safeTrim(body?.action).toLowerCase();

  // ✅ 允许两种情况继续：
  // 1) action === "update"
  // 2) action 为空，但带了 links/visibility（当作 update）
  const hasUpdateFields =
    Array.isArray(body?.links) || typeof body?.visibility !== "undefined";

  if (action && action !== "update") {
    return NextResponse.json({ ok: false, error: "UNSUPPORTED_ACTION" }, { status: 400 });
  }

  if (!action && !hasUpdateFields) {
    // 没 action 也没字段，直接报错更清晰
    return NextResponse.json({ ok: false, error: "MISSING_UPDATE_FIELDS" }, { status: 400 });
  }

  const links = safeLinks(body?.links);
  const visibility = safeUpper(body?.visibility) || undefined;

  const res = await updateAiDraftEditFields({
    id,
    links,
    visibility: visibility as any,
  });

  if (!res) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if ((res as any)?.ok === false) return NextResponse.json(res, { status: 403 });

  return NextResponse.json({ ok: true, draft: (res as any).draft ?? res });
}
