"use client";

import React, { useMemo, useState } from "react";
import AiMessageList, { UiMsg } from "./AiMessageList";
import AiComposer from "./AiComposer";
import ProofDraftList from "./ProofDraftList";
import { postRecognize } from "@/lib/client/ai";
import { createDraft } from "@/lib/client/aiProofs";

export default function AiChat() {
  const [msgs, setMsgs] = useState<UiMsg[]>([
    {
      role: "assistant",
      text: "Describe something you did (or are doing). I’ll structure it as a contribution draft — without hype."
    }
  ]);

  const [busy, setBusy] = useState(false);
  const [lastAssessment, setLastAssessment] = useState<any>(null);

  async function onSend(text: string) {
    const t = text.trim();
    if (!t) return;

    setMsgs((m) => [...m, { role: "user", text: t }]);
    setBusy(true);
    try {
      const res: any = await postRecognize({ text: t, locale: "zh" });
      if (!res?.ok) throw new Error(res?.error || "recognize failed");

      // ✅ 只认 assessment（后端已改成 recognize 不自动创建 draft）
      const a: any = res?.assessment ?? null;
      if (!a) throw new Error("recognize returned empty assessment");

      setLastAssessment(a);

      const type = a?.type ?? "OTHER";
      const title = a?.title ?? "Untitled";
      const summary = a?.summary ?? "";
      const verifiability = a?.verifiability ?? "LOW";
      const repeatable = !!a?.repeatable;

      const sv = String(a?.suggestedVisibility || "PRIVATE").toUpperCase();
      const suggestedVisibility = sv === "PUBLIC" ? "PUBLIC" : "PRIVATE";

      const followup = a?.followups?.[0]?.question ?? "—";

      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          text:
            `Type: ${type}\n` +
            `Title: ${title}\n\n` +
            `${summary}\n\n` +
            `Verifiability: ${verifiability} · Repeatable: ${repeatable ? "Yes" : "No"}\n` +
            `Suggested visibility: ${suggestedVisibility}\n\n` +
            `Follow-up: ${followup}`
        }
      ]);
    } catch (e: any) {
      setMsgs((m) => [
        ...m,
        { role: "assistant", text: `Error: ${e?.message || "unknown"}` }
      ]);
      setLastAssessment(null);
    } finally {
      setBusy(false);
    }
  }

  async function onCreateDraft() {
    if (!lastAssessment) return;
    setBusy(true);
    try {
      const type = lastAssessment?.type ?? "OTHER";
      const title = lastAssessment?.title ?? "Untitled";
      const summary = lastAssessment?.summary ?? "";

      const ver = String(lastAssessment?.verifiability || "LOW").toUpperCase();
      const verifiability = ver === "HIGH" || ver === "MEDIUM" ? ver : "LOW";

      const sv = String(lastAssessment?.suggestedVisibility || "PRIVATE").toUpperCase();
      const suggestedVisibility = sv === "PUBLIC" ? "PUBLIC" : "PRIVATE";

      const safeAssessment = {
        ...lastAssessment,
        ok: lastAssessment?.ok ?? true,

        type: lastAssessment?.type ?? "OTHER",
        title: lastAssessment?.title ?? "Untitled",
        summary: lastAssessment?.summary ?? "",

        // ✅ 这里必须是 LOW/MEDIUM/HIGH，不能是 "—"
        verifiability: (lastAssessment?.verifiability === "HIGH" ||
                       lastAssessment?.verifiability === "MEDIUM" ||
                       lastAssessment?.verifiability === "LOW")
         ? lastAssessment.verifiability
         : "LOW",

        repeatable: !!lastAssessment?.repeatable,

         // ✅ 这里必须是 PRIVATE/PUBLIC
        suggestedVisibility: (lastAssessment?.suggestedVisibility === "PUBLIC" ||
                             lastAssessment?.suggestedVisibility === "PRIVATE")
         ? lastAssessment.suggestedVisibility
         : "PRIVATE",

        tags: Array.isArray(lastAssessment?.tags) ? lastAssessment.tags : [],
        followups: Array.isArray(lastAssessment?.followups) ? lastAssessment.followups : [],
    };


      const res: any = await createDraft({ assessment: safeAssessment });
      if (!res?.ok) throw new Error(res?.error || "create draft failed");

      setMsgs((m) => [
        ...m,
        {
          role: "assistant",
          text: `Draft created: ${res.draft.id} (${res.draft.assessment.type} · ${res.draft.assessment.title})`
        }
      ]);
    } catch (e: any) {
      setMsgs((m) => [
        ...m,
        { role: "assistant", text: `Error: ${e?.message || "unknown"}` }
      ]);
    } finally {
      setBusy(false);
    }
  }

  const canCreate = useMemo(() => !!lastAssessment && !busy, [lastAssessment, busy]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-black/10 p-4">
        <AiMessageList messages={msgs} />
        <div className="mt-3 flex items-center gap-2">
          <AiComposer disabled={busy} onSend={onSend} />
          <button
            onClick={onCreateDraft}
            disabled={!canCreate}
            className="rounded-xl border border-black/10 px-3 py-2 text-sm disabled:opacity-40"
          >
            Create Draft
          </button>
        </div>
      </div>

      <ProofDraftList />
    </div>
  );
}
