// apps/web/src/app/api/ai/route.ts
import { NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/server/ai/openai";
import { RECOGNIZE_PROMPT } from "@/lib/ai/prompts/recognize";
import { isAssessment, explainInvalidAssessment } from "@/lib/ai/validators";
import { createAiDraftFromAssessment } from "@/lib/ai-proofs/store";
import { VALIDATORS_VERSION } from "@/lib/ai/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function detectWaocProduct(inputRaw: string) {
  const s = String(inputRaw || "").trim().toLowerCase();

  const hit =
    s === "one mission" ||
    s.includes("one mission") ||
    s === "one field" ||
    s.includes("one field") ||
    s === "one ai" ||
    s.includes("one ai") ||
    s.includes("waoc");

  if (!hit) return null;

  if (s.includes("one mission")) {
    return {
      ok: true,
      type: "SUPPORT",
      title: "Explain One Mission module",
      summary:
        "User is asking about the One Mission system and what it can do, including missions, proof submission, approval, and points.",
      verifiability: "LOW",
      repeatable: false,
      suggestedVisibility: "PUBLIC",
      tags: ["waoc", "one-mission"],
      followups: [
        {
          question:
            "Are you interested in creating a mission, submitting proof, or viewing existing missions?",
          reason: "To guide the user to the correct workflow.",
        },
      ],
    };
  }

  if (s.includes("one field")) {
    return {
      ok: true,
      type: "SUPPORT",
      title: "Explain One Field module",
      summary:
        "User is asking about One Field: a minimalist presence layer that reflects a collective state in one sentence.",
      verifiability: "LOW",
      repeatable: false,
      suggestedVisibility: "PUBLIC",
      tags: ["waoc", "one-field"],
      followups: [
        {
          question: "Do you want to generate the next field sentence or explain One Field to users?",
          reason: "To clarify the intended next action.",
        },
      ],
    };
  }

  if (s.includes("one ai")) {
    return {
      ok: true,
      type: "SUPPORT",
      title: "Explain One AI assistant",
      summary:
        "User is asking about One AI: it turns user actions into structured drafts and guides next steps in the system.",
      verifiability: "LOW",
      repeatable: false,
      suggestedVisibility: "PUBLIC",
      tags: ["waoc", "one-ai"],
      followups: [
        {
          question: "What should One AI help with: missions, proofs, or onboarding?",
          reason: "To route the user to the right feature.",
        },
      ],
    };
  }

  return {
    ok: true,
    type: "SUPPORT",
    title: "Explain WAOC ecosystem",
    summary:
      "User is asking about WAOC ecosystem modules and what they do.",
    verifiability: "LOW",
    repeatable: false,
    suggestedVisibility: "PUBLIC",
    tags: ["waoc"],
    followups: [
      {
        question: "Which module do you want to work on now: missions, proofs, app, or NFT?",
        reason: "To select the right workflow.",
      },
    ],
  };
}

function safeTrim(v: any) {
  return String(v ?? "").trim();
}

function pickAction(body: any): "recognize" | "share_quiet" | "share_viral" {
  const a = safeTrim(body?.action).toLowerCase();
  if (a === "share_quiet") return "share_quiet";
  if (a === "share_viral") return "share_viral";
  return "recognize";
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = pickAction(body);

    /* =========================
     * recognize (REAL LLM → optional create draft)
     * ========================= */
    if (action === "recognize") {
      const text = safeTrim(body?.text);
      const locale = safeTrim(body?.locale) || "zh";

      if (!text) {
        return NextResponse.json(
          { ok: false, error: "EMPTY_INPUT", validatorsVersion: VALIDATORS_VERSION },
          { status: 400 }
        );
      }

      // ✅ 新增：默认不创建 draft，只有显式 createDraft=true 才创建（避免双 draft）
      const shouldCreateDraft = body?.createDraft === true;

      // ✅ 新增：WAOC 产品关键词优先（绕过 LLM，避免误判）
      const override = detectWaocProduct(text);
      if (override) {
        if (shouldCreateDraft) {
          const draft = await createAiDraftFromAssessment({ assessment: override });
          return NextResponse.json({
            ok: true,
            action,
            locale,
            input: text,
            assessment: override,
            draft,
            validatorsVersion: VALIDATORS_VERSION,
          });
        }

        return NextResponse.json({
          ok: true,
          action,
          locale,
          input: text,
          assessment: override,
          validatorsVersion: VALIDATORS_VERSION,
        });
      }

      const client = getOpenAIClient();
      if (!client) {
        return NextResponse.json(
          { ok: false, error: "OPENAI_KEY_MISSING", validatorsVersion: VALIDATORS_VERSION },
          { status: 500 }
        );
      }

      // 1) Call LLM (JSON only)
      const completion = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              RECOGNIZE_PROMPT +
              "\n\nIMPORTANT: Return JSON only. No markdown. No extra text.",
          },
          {
            role: "user",
            content: JSON.stringify({ text, locale }),
          },
        ],
        temperature: 0.2,
      });

      const raw = completion?.choices?.[0]?.message?.content ?? "{}";

      let assessment: any;
      try {
        assessment = JSON.parse(raw);
      } catch {
        return NextResponse.json(
          { ok: false, error: "MODEL_NOT_JSON", raw, validatorsVersion: VALIDATORS_VERSION },
          { status: 502 }
        );
      }

      // 2) Validate assessment strictly
      // （保留你的原校验逻辑，不动结构）
      if (!isAssessment(assessment)) {
        const why = explainInvalidAssessment(assessment);
        return NextResponse.json(
          { ok: false, error: "INVALID_ASSESSMENT", why, assessment, validatorsVersion: VALIDATORS_VERSION },
          { status: 422 }
        );
      }

      const why = explainInvalidAssessment(assessment);
      if (why) {
        return NextResponse.json(
          { ok: false, error: "INVALID_ASSESSMENT", why, assessment, validatorsVersion: VALIDATORS_VERSION },
          { status: 422 }
        );
      }

      // ✅ 修改点：不再默认创建 draft（避免你前端再点 Create Draft 时产生第二条）
      if (shouldCreateDraft) {
        const draft = await createAiDraftFromAssessment({ assessment });
        return NextResponse.json({
          ok: true,
          action,
          locale,
          input: text,
          assessment,
          draft,
          validatorsVersion: VALIDATORS_VERSION,
        });
      }

      // 只返回 assessment（前端点 Create Draft 再创建）
      return NextResponse.json({
        ok: true,
        action,
        locale,
        input: text,
        assessment,
        validatorsVersion: VALIDATORS_VERSION,
      });
    }

    /* =========================
     * share_quiet (stub v1)
     * ========================= */
    if (action === "share_quiet") {
      const draftId = safeTrim(body?.draftId);
      if (!draftId) {
        return NextResponse.json(
          { ok: false, error: "MISSING_DRAFT_ID" },
          { status: 400 }
        );
      }

      return NextResponse.json({
        ok: true,
        action,
        draftId,
        text:
          "A contribution draft was recorded.\n" +
          "This reflects an action described by the user.\n" +
          "The draft remains available for refinement.",
      });
    }

    /* =========================
     * share_viral (proxy to /api/ai/viral)
     * ========================= */
    if (action === "share_viral") {
      const proofId = safeTrim(body?.proofId);
      if (!proofId) {
        return NextResponse.json(
          { ok: false, error: "MISSING_PROOF_ID" },
          { status: 400 }
        );
      }

      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

      const url = baseUrl ? `${baseUrl}/api/ai/viral` : `/api/ai/viral`;

      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proofId }),
        cache: "no-store",
      });

      const data = await r.json().catch(() => ({}));
      return NextResponse.json({ ...data, action });
    }

    return NextResponse.json(
      { ok: false, error: "UNSUPPORTED_ACTION" },
      { status: 400 }
    );
  } catch (err: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: err?.message || "unknown error",
      },
      { status: 500 }
    );
  }
}
