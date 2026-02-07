"use client";

import React, { useMemo, useState } from "react";
import { updateDraft } from "@/lib/client/aiProofs";

type Props = {
  draft: any;
  onChanged: () => void;
};

export default function ProofDraftEditor({ draft, onChanged }: Props) {
  const [linksText, setLinksText] = useState<string>(
    Array.isArray(draft?.payload?.links)
      ? draft.payload.links.join("\n")
      : ""
  );

  const [visibility, setVisibility] = useState<string>(
    draft?.payload?.visibility || "PRIVATE"
  );

  const [busy, setBusy] = useState<boolean>(false);

  /** parsed links */
  const links = useMemo<string[]>(() => {
    return linksText
      .split("\n")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0);
  }, [linksText]);

  async function save() {
    if (!draft?.id) return;

    setBusy(true);
    try {
      const res = await updateDraft({
        id: draft.id,
        links,
        visibility
      });

      if (res?.ok) {
        onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-black/5 p-3">
      <div className="text-xs font-semibold">Edit Draft</div>

      <div className="mt-2 grid gap-2">
        <label className="text-xs opacity-70">
          Links (one per line)
        </label>

        <textarea
          value={linksText}
          onChange={(e) => setLinksText(e.target.value)}
          placeholder="https://...\nhttps://..."
          className="min-h-[70px] rounded-xl border border-black/10 bg-white px-3 py-2 text-xs outline-none"
        />

        <div className="flex items-center gap-2">
          <label className="text-xs opacity-70">Visibility</label>

          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
            className="rounded-xl border border-black/10 bg-white px-2 py-1 text-xs"
          >
            <option value="PRIVATE">PRIVATE</option>
            <option value="PUBLIC">PUBLIC</option>
          </select>

          <button
            onClick={save}
            disabled={busy}
            className="ml-auto rounded-xl bg-black px-3 py-1.5 text-xs text-white disabled:opacity-40"
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
