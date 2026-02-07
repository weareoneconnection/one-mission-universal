"use client";

import React, { useEffect, useState } from "react";
import { listDrafts } from "@/lib/client/aiProofs";
import ProofDraftCard from "./ProofDraftCard";

export default function ProofDraftList() {
  const [drafts, setDrafts] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    try {
      const res = await listDrafts({});
      if (res.ok) setDrafts(res.drafts || []);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <div className="rounded-2xl border border-black/10 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-sm font-semibold">Proof Drafts</div>
        <button
          onClick={refresh}
          className="rounded-xl border border-black/10 px-3 py-1.5 text-xs"
          disabled={busy}
        >
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        {drafts.length === 0 ? (
          <div className="text-sm opacity-60">No drafts yet.</div>
        ) : (
          drafts.map((d) => <ProofDraftCard key={d.id} draft={d} onChanged={refresh} />)
        )}
      </div>
    </div>
  );
}
