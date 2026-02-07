import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAiDraftById } from "@/lib/ai-proofs/store";
import type { AiProofDraft } from "@/lib/ai-proofs/types"; // 如果你没有这个路径，就删掉这一行和下面的类型注释

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeTrim(v: any) {
  return String(v ?? "").trim();
}

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/ai-proofs/:id/sign-message
 * returns { signMessage, draft }
 */
export async function POST(req: NextRequest, ctx: Ctx) {
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

    // 你原来项目里应该已经有生成 signMessage 的逻辑；
    // 这里保持最小结构：优先用 draft.signMessage，其次用 draft.message，再不行给一个 fallback。
    const signMessage =
      safeTrim((draft as any).signMessage) ||
      safeTrim((draft as any).message) ||
      `AI PROOF — SIGN MESSAGE\n\nDraft: ${draftId}`;

    return NextResponse.json({ ok: true, signMessage, draft: draft as any });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
