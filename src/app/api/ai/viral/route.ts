// apps/web/src/app/api/ai/viral/route.ts
import { NextResponse } from "next/server";
import { VIRAL_PROMPT } from "@/lib/ai/prompts/viral";

// 你原来用的是 proof-store（沿用）
import { getProofById } from "@/lib/proof-store";

// ✅ 你的项目里封装了 OpenAI client
import { getOpenAIClient } from "@/lib/server/ai/openai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function safeTrim(v: any) {
  return String(v ?? "").trim();
}

// 兼容不同对象的状态字段（Proof / ai-proof / draft）
function getAnyStatus(x: any): string {
  return String(x?.status ?? x?.currentStatus ?? "").toUpperCase();
}

function getAnyVisibility(x: any): string {
  // 兼容 proof.payload.visibility / visibility
  const v = x?.payload?.visibility ?? x?.visibility ?? "";
  return String(v).toUpperCase();
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const proofId = safeTrim(body?.proofId);

    if (!proofId) {
      return NextResponse.json({ ok: false, error: "MISSING_PROOF_ID" }, { status: 400 });
    }

    const proof: any = await getProofById(proofId);
    if (!proof) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    // ✅ 只允许已提交的 proof（你后面可扩展 SIGNED / APPROVED 等）
    const st = getAnyStatus(proof);
    if (st !== "SUBMITTED") {
      return NextResponse.json(
        { ok: false, error: "NOT_SUBMITTED", status: st },
        { status: 403 }
      );
    }

    // ✅ 只允许 PUBLIC 才能 viral（避免把私密内容传播出去）
    const vis = getAnyVisibility(proof);
    if (vis !== "PUBLIC") {
      return NextResponse.json(
        { ok: false, error: "NOT_PUBLIC", visibility: vis },
        { status: 403 }
      );
    }

    // 输入给模型：优先 payload（你系统的标准化内容）
    const payload = proof?.payload ?? proof;

    // ✅ 修复点：拿到 openai client 实例
    const openai = getOpenAIClient();
    if (!openai) {
      return NextResponse.json(
        { ok: false, error: "OPENAI_NOT_CONFIGURED" },
        { status: 500 }
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: VIRAL_PROMPT },
        { role: "user", content: JSON.stringify(payload) },
      ],
      temperature: 0.4,
    });

    const raw = completion?.choices?.[0]?.message?.content ?? "{}";

    let result: any = {};
    try {
      result = JSON.parse(raw);
    } catch {
      // 模型万一没返回 JSON，兜底成可用结构（不崩前端）
      result = {
        ok: false,
        error: "MODEL_NOT_JSON",
        raw,
      };
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", message: String(e?.message || e) },
      { status: 500 }
    );
  }
}
