import { NextResponse } from "next/server";
import { recognizeContribution } from "@/lib/ai/recognize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/ai
 * 输入：{ text: string, locale?: "zh"|"en" }
 * 输出：{ ok: true, assessment }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text = String(body?.text || "").trim();
    const locale = (String(body?.locale || "zh") as "zh" | "en") || "zh";

    if (!text) {
      return NextResponse.json({ ok: false, error: "EMPTY_INPUT" }, { status: 400 });
    }

    const assessment = await recognizeContribution({ text, locale });

    return NextResponse.json({ ok: true, input: text, assessment });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "INTERNAL_ERROR", message: err?.message || "unknown error" },
      { status: 500 }
    );
  }
}
