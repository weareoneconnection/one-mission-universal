"use client";

import React, { useState } from "react";
import { saveAiSignature, submitAiDraft } from "@/lib/client/aiProofs";

export default function SignSubmitBar({
  draft,
  onChanged
}: {
  draft: any;
  onChanged: () => void;
}) {
  const [wallet, setWallet] = useState(draft?.wallet || "");
  const [chain, setChain] = useState<"solana" | "evm">(draft?.chain || "solana");
  const [signMessage, setSignMessage] = useState(draft?.signMessage || "");
  const [signature, setSignature] = useState(draft?.signature || "");
  const [busy, setBusy] = useState(false);

  async function genMessage() {
    if (!wallet.trim()) return;
    setBusy(true);
    try {
      // ✅ MVP：本地生成 signMessage（不依赖 getSignMessage API）
      // 以后你接真实钱包签名时，也可以把这里替换成后端生成/标准化版本
      const msg =
        `ONE AI DRAFT SIGNATURE\n\n` +
        `Draft: ${draft?.id || "—"}\n` +
        `Wallet: ${wallet.trim()}\n` +
        `Chain: ${chain}\n` +
        `Time: ${new Date().toISOString()}\n\n` +
        `Payload:\n` +
        `${JSON.stringify(draft?.payload ?? {}, null, 2)}\n`;

      setSignMessage(msg);
    } finally {
      setBusy(false);
    }
  }

  async function saveSig() {
    if (!wallet.trim() || !signature.trim()) return;
    setBusy(true);
    try {
      const res: any = await saveAiSignature({
        id: draft.id,
        wallet: wallet.trim(),
        chain,
        signature: signature.trim()
      });

      if (res?.ok) {
        // ✅ 让当前组件立刻“看到”签名已经存在（否则 draft.signature 还是旧的）
        try {
          draft.wallet = wallet.trim();
          draft.chain = chain;
          draft.signature = signature.trim();
          draft.signMessage = signMessage;
        } catch {}

        onChanged();
      }
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    try {
      // ✅ submitAiDraft 的 server/store 接口是 submitAiDraft(id: string)
      const res: any = await submitAiDraft(draft.id);
      if (res?.ok) onChanged();
    } finally {
      setBusy(false);
    }
  }

  function fakeSign() {
    // MVP：方便测试流程（后面接钱包签名会替换）
    if (!signMessage) return;
    setSignature(`FAKE_SIG_${Date.now()}`);
  }

  return (
    <div className="rounded-2xl bg-black/5 p-3">
      <div className="text-xs font-semibold">Sign & Submit (MVP)</div>

      <div className="mt-2 grid gap-2">
        <div className="flex gap-2">
          <input
            value={wallet}
            onChange={(e) => setWallet(e.target.value)}
            placeholder="Wallet address (for now you can type any string)"
            className="flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs outline-none"
          />
          <select
            value={chain}
            onChange={(e) => setChain(e.target.value as any)}
            className="rounded-xl border border-black/10 bg-white px-2 py-2 text-xs"
          >
            <option value="solana">solana</option>
            <option value="evm">evm</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={genMessage}
            disabled={busy || !wallet.trim()}
            className="rounded-xl border border-black/10 px-3 py-2 text-xs disabled:opacity-40"
          >
            Generate signMessage
          </button>
          <button
            onClick={() => navigator.clipboard.writeText(signMessage || "")}
            disabled={!signMessage}
            className="rounded-xl border border-black/10 px-3 py-2 text-xs disabled:opacity-40"
          >
            Copy message
          </button>
        </div>

        {signMessage ? (
          <pre className="whitespace-pre-wrap rounded-xl border border-black/10 bg-white p-2 text-[11px]">
            {signMessage}
          </pre>
        ) : null}

        <div className="flex gap-2">
          <input
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            placeholder="Signature (MVP: click Fake Sign)"
            className="flex-1 rounded-xl border border-black/10 bg-white px-3 py-2 text-xs outline-none"
          />
          <button
            onClick={fakeSign}
            disabled={!signMessage}
            className="rounded-xl border border-black/10 px-3 py-2 text-xs disabled:opacity-40"
          >
            Fake Sign
          </button>
          <button
            onClick={saveSig}
            disabled={busy || !wallet.trim() || !signature.trim()}
            className="rounded-xl bg-black px-3 py-2 text-xs text-white disabled:opacity-40"
          >
            Save
          </button>
        </div>

        <button
          onClick={submit}
          // ✅ 用本地 signature 判断（否则 draft.signature 还没刷新时按钮一直灰）
          disabled={busy || !signature.trim()}
          className="rounded-xl bg-black px-3 py-2 text-xs text-white disabled:opacity-40"
        >
          Submit (stub)
        </button>

        <div className="text-[11px] opacity-60">
          Note: submit is currently a safe stub (no impact to your existing proof system).
        </div>
      </div>
    </div>
  );
}
