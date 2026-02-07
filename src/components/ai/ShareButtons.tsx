"use client";

import React, { useState } from "react";
import { buildShare } from "@/lib/client/share";

export default function ShareButtons({ draftId }: { draftId: string }) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");

  async function gen(platform: "x" | "telegram") {
    setBusy(true);
    try {
      const res = await buildShare({ draftId, platform, locale: "zh" });
      if (res.ok) setText(res.text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-black/5 p-3">
      <div className="text-xs font-semibold">Share (quiet)</div>

      <div className="mt-2 flex gap-2">
        <button
          onClick={() => gen("x")}
          disabled={busy}
          className="rounded-xl border border-black/10 px-3 py-2 text-xs disabled:opacity-40"
        >
          Generate X text
        </button>
        <button
          onClick={() => gen("telegram")}
          disabled={busy}
          className="rounded-xl border border-black/10 px-3 py-2 text-xs disabled:opacity-40"
        >
          Generate Telegram text
        </button>
        <button
          onClick={() => navigator.clipboard.writeText(text || "")}
          disabled={!text}
          className="ml-auto rounded-xl bg-black px-3 py-2 text-xs text-white disabled:opacity-40"
        >
          Copy
        </button>
      </div>

      {text ? (
        <pre className="mt-2 whitespace-pre-wrap rounded-xl border border-black/10 bg-white p-2 text-[11px]">
          {text}
        </pre>
      ) : (
        <div className="mt-2 text-[11px] opacity-60">No share text yet.</div>
      )}
    </div>
  );
}
