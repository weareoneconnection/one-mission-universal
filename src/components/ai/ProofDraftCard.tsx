"use client";

import React, { useState } from "react";
import ProofDraftEditor from "./ProofDraftEditor";
import SignSubmitBar from "./SignSubmitBar";
import ShareButtons from "./ShareButtons";

export default function ProofDraftCard({
  draft,
  onChanged
}: {
  draft: any;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);

  const a = draft?.assessment;
  return (
    <div className="rounded-2xl border border-black/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold">
            {a?.type || "—"} · {a?.title || draft?.payload?.title || "Untitled"}
          </div>
          <div className="mt-1 text-xs opacity-70 line-clamp-3 whitespace-pre-wrap">
            {a?.summary || draft?.payload?.description || "—"}
          </div>
          <div className="mt-2 text-[11px] opacity-60">
            id: {draft.id} · status: {draft.status} · verifiability: {a?.verifiability}
          </div>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 rounded-xl border border-black/10 px-3 py-1.5 text-xs"
        >
          {open ? "Close" : "Open"}
        </button>
      </div>

      {open ? (
        <div className="mt-3 space-y-3">
          <ProofDraftEditor draft={draft} onChanged={onChanged} />
          <SignSubmitBar draft={draft} onChanged={onChanged} />
          <ShareButtons draftId={draft.id} />
        </div>
      ) : null}
    </div>
  );
}
