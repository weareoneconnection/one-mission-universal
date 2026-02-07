"use client";

import React, { useState } from "react";

export default function AiComposer({
  onSend,
  disabled
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");

  function submit() {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText("");
  }

  return (
    <div className="flex flex-1 items-center gap-2">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={disabled}
        placeholder="Describe your action…"
        className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none disabled:opacity-40"
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
      />
      <button
        onClick={submit}
        disabled={disabled}
        className="rounded-xl bg-black px-3 py-2 text-sm text-white disabled:opacity-40"
      >
        Send
      </button>
    </div>
  );
}
