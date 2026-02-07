import { NextResponse } from "next/server";
import { getAiDraftById } from "@/lib/ai-proofs/store";
import { buildShareText } from "@/lib/ai/share";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/share
 * { draftId: string, platform: "x"|"telegram", locale?: "zh"|"en" }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const draftId = String(body?.draftId || "").trim();
    const platform = (String(body?.platform || "x") as "x" | "telegram") || "x";
    const locale = (String(body?.locale || "zh") as "zh" | "en") || "zh";

    if (!draftId) return NextResponse.json({ ok: false, error: "MISSING_DRAFT_ID" }, { status: 400 });

    const draft = await getAiDraftById(draftId);
    if (!draft) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const text = buildShareText({ draft, platform, locale });

    return NextResponse.json({ ok: true, text });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: err?.message || "unknown error" },
      { status: 500 }
    );
  }
}
