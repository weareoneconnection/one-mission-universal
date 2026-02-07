import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getAiDraftById } from "@/lib/ai-proofs/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeTrim(v: any) {
  return String(v ?? "").trim();
}

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/ai-proofs/:id/sign
 * Returns draft (or error)
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

    return NextResponse.json({ ok: true, draft });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
