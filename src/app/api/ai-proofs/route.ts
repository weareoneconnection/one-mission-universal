import { NextResponse } from "next/server";
import { listAiDrafts, createAiDraftFromAssessment } from "@/lib/ai-proofs/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/ai-proofs
 */
export async function GET() {
  const drafts = await listAiDrafts();
  return NextResponse.json({ ok: true, drafts });
}

/**
 * POST /api/ai-proofs
 * Body: { assessment }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const assessment = body?.assessment;

    if (!assessment) {
      return NextResponse.json(
        { ok: false, error: "MISSING_ASSESSMENT" },
        { status: 400 }
      );
    }

    const draft = await createAiDraftFromAssessment(assessment);
    return NextResponse.json({ ok: true, draft });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "INTERNAL_ERROR" },
      { status: 500 }
    );
  }
}
