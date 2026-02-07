import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAiDraftById, updateAiDraftEditFields } from "@/lib/ai-proofs/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeTrim(v: any) {
  return String(v ?? "").trim();
}

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/ai-proofs/:id/submit
 */
export async function POST(_req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const draftId = safeTrim(id);
    if (!draftId) {
      return NextResponse.json({ ok: false, error: "MISSING_ID" }, { status: 400 });
    }

    const draft = await getAiDraftById(draftId);
    if (!draft) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    // 兼容：如果已经提交过（字段名不确定，做宽松判断）
    const already =
      (draft as any).submittedAt ||
      (draft as any).status === "SUBMITTED" ||
      (draft as any).state === "SUBMITTED";

    if (already) {
      return NextResponse.json({ ok: false, error: "ALREADY_SUBMITTED", draft } as any, { status: 409 });
    }

    // ✅ 最小提交：写一个 submittedAt（不破坏其他字段）
    const res = await updateAiDraftEditFields({
      id: draftId,
      submittedAt: Date.now(),
      status: "SUBMITTED",
    } as any);

    // updateAiDraftEditFields 你的实现可能返回 draft 或 {ok:false}
    if (!res) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    if ((res as any)?.ok === false) return NextResponse.json(res as any, { status: 403 });

    const nextDraft = (res as any).draft ?? res;

    return NextResponse.json({ ok: true, draft: nextDraft } as any);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
