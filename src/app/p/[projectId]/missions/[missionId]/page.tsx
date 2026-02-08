"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { buildProofMessage, randomNonce } from "@/lib/proofs/message";

type Mission = {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  proofType: "SIGN_MESSAGE";
  weight: number;
  active: boolean;
  createdAt: number;
  updatedAt: number;
};

type ProofDraft = {
  version: 1;
  missionId: string;
  projectId: string;
  wallet: string;
  proofType: "SIGN_MESSAGE";
  message: string;
  signature: string; // base58
  nonce: string;
  issuedAt: number;
  domain: string;
};

function draftKey(projectId: string, missionId: string, wallet: string) {
  return `proof_draft:v1:${projectId}:${missionId}:${wallet}`;
}

function loadDraft(projectId: string, missionId: string, wallet: string): ProofDraft | null {
  if (!projectId || !missionId || !wallet) return null;
  try {
    const raw = localStorage.getItem(draftKey(projectId, missionId, wallet));
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj?.missionId || !obj?.wallet || !obj?.projectId) return null;
    return obj as ProofDraft;
  } catch {
    return null;
  }
}

function saveDraft(d: ProofDraft) {
  localStorage.setItem(draftKey(d.projectId, d.missionId, d.wallet), JSON.stringify(d));
}

function clearDraft(projectId: string, missionId: string, wallet: string) {
  localStorage.removeItem(draftKey(projectId, missionId, wallet));
}

export default function MissionDetailPage() {
  const params = useParams<{ projectId: string; missionId: string }>();
  const router = useRouter();

  const projectId = String(params?.projectId || "");
  const missionId = String(params?.missionId || "");

  const { publicKey, signMessage, connected } = useWallet();
  const walletStr = useMemo(() => (publicKey ? publicKey.toBase58() : ""), [publicKey]);

  const [loading, setLoading] = useState(true);
  const [m, setM] = useState<Mission | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [draft, setDraft] = useState<ProofDraft | null>(null);

  const [signing, setSigning] = useState(false);
  const [uiMsg, setUiMsg] = useState<string | null>(null);

  async function loadMission() {
    if (!missionId) return;
    setLoading(true);
    setErr(null);
    try {
      // 先继续复用你现有 /api/missions（全局列表），后续你可以换成 /api/projects/[projectId]/missions
      const res = await fetch("/api/missions", { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Failed to load missions");

      const found = (data.missions as Mission[]).find((x) => x.id === missionId) || null;

      if (!found) throw new Error("Mission not found");
      if (found.projectId !== projectId) {
        throw new Error(`Project mismatch. URL=${projectId}, mission.projectId=${found.projectId}`);
      }

      setM(found);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  // load mission
  useEffect(() => {
    setUiMsg(null);
    loadMission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, missionId]);

  // load draft when wallet or mission changes
  useEffect(() => {
    setUiMsg(null);
    if (!projectId || !missionId || !walletStr) {
      setDraft(null);
      return;
    }
    const d = loadDraft(projectId, missionId, walletStr);
    setDraft(d);
  }, [projectId, missionId, walletStr]);

  const isSigned = !!draft?.signature;

  async function onSign() {
    setUiMsg(null);

    if (!m) return;
    if (!m.active) return setUiMsg("This mission is inactive.");
    if (!connected || !publicKey) return setUiMsg("Wallet not connected.");
    if (!signMessage) return setUiMsg("Wallet does not support signMessage.");

    setSigning(true);
    try {
      const issuedAt = Date.now();
      const nonce = randomNonce();
      const domain = typeof window !== "undefined" ? window.location.host : "unknown";

      const message = buildProofMessage({
        domain,
        wallet: walletStr,
        projectId: m.projectId,
        missionId: m.id,
        missionTitle: m.title,
        issuedAt,
        nonce,
      });

      const msgBytes = new TextEncoder().encode(message);
      const sigBytes = await signMessage(msgBytes);
      const signature = bs58.encode(sigBytes);

      const nextDraft: ProofDraft = {
        version: 1,
        missionId: m.id,
        projectId: m.projectId,
        wallet: walletStr,
        proofType: "SIGN_MESSAGE",
        message,
        signature,
        nonce,
        issuedAt,
        domain,
      };

      saveDraft(nextDraft);
      setDraft(nextDraft);
      setUiMsg("✅ Signed. Continue to submit proof for review.");
    } catch (e: any) {
      setUiMsg(`❌ Sign failed: ${String(e?.message || e)}`);
    } finally {
      setSigning(false);
    }
  }

  function onGoSubmit() {
    setUiMsg(null);

    if (!m) return;
    if (!m.active) return setUiMsg("This mission is inactive.");
    if (!connected || !publicKey) return setUiMsg("Wallet not connected.");

    if (!draft?.signature || !draft?.message) {
      return setUiMsg("Please sign first.");
    }

    router.push(`/p/${projectId}/missions/${missionId}/submit`);
  }

  function onClearDraft() {
    setUiMsg(null);
    if (!projectId || !missionId || !walletStr) return;
    clearDraft(projectId, missionId, walletStr);
    setDraft(null);
    setUiMsg("Draft cleared.");
  }

  if (!projectId || !missionId) {
    return (
      <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Missing params</h1>
        <div style={{ marginTop: 10, opacity: 0.75 }}>
          projectId: <code>{projectId || "(missing)"}</code> · missionId: <code>{missionId || "(missing)"}</code>
        </div>
        <a href="/missions" style={{ textDecoration: "underline" }}>
          Back
        </a>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Loading...</h1>
      </main>
    );
  }

  if (err) {
    return (
      <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Error</h1>
        <div style={{ marginTop: 8, color: "#b91c1c" }}>{err}</div>
        <div style={{ marginTop: 16 }}>
          <a href="/missions" style={{ textDecoration: "underline" }}>
            Back
          </a>
        </div>
      </main>
    );
  }

  if (!m) {
    return (
      <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 950 }}>Mission not found</h1>
        <div style={{ marginTop: 8, opacity: 0.7 }}>
          missionId: <code>{missionId}</code>
        </div>
        <div style={{ marginTop: 16 }}>
          <a href="/missions" style={{ textDecoration: "underline" }}>
            Back
          </a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 950 }}>{m.title}</h1>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
            missionId: {m.id} · projectId: {m.projectId} · proof: {m.proofType} · weight: {m.weight} ·{" "}
            {m.active ? "active" : "inactive"}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href={`/p/${projectId}/missions`} style={{ textDecoration: "underline" }}>
            Project Missions
          </a>
          <button
            type="button"
            onClick={loadMission}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Refresh
          </button>
        </div>
      </header>

      {m.description && (
        <section style={{ marginTop: 16, padding: 14, border: "1px solid #e5e7eb", borderRadius: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800 }}>Description</h2>
          <div style={{ marginTop: 8, opacity: 0.9 }}>{m.description}</div>
        </section>
      )}

      <section style={{ marginTop: 16, padding: 14, border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800 }}>Proof</h2>

        <div style={{ marginTop: 8, opacity: 0.85, lineHeight: 1.7 }}>
          Wallet:{" "}
          {walletStr ? (
            <span style={{ fontFamily: "monospace" }}>{walletStr}</span>
          ) : (
            <span style={{ color: "#b91c1c" }}>not connected</span>
          )}
          <br />
          Proof type: <b>SIGN_MESSAGE</b>
          <br />
          Flow: <b>Sign</b> → <b>Submit Evidence</b> → <b>Project Approval</b> → <b>Points</b>
        </div>

        <div style={{ marginTop: 10, fontWeight: 800 }}>
          Draft status:{" "}
          <span style={{ color: isSigned ? "#16a34a" : "#b45309" }}>
            {isSigned ? "signed" : "not signed yet"}
          </span>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onSign}
            disabled={signing || !walletStr}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #111827",
              background: "#111827",
              color: "white",
              fontWeight: 900,
              cursor: signing || !walletStr ? "not-allowed" : "pointer",
              opacity: signing || !walletStr ? 0.6 : 1,
            }}
          >
            {signing ? "Signing..." : "Sign Message"}
          </button>

          <button
            type="button"
            onClick={onGoSubmit}
            disabled={!walletStr || !isSigned}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "2px solid #111827",
              background: "white",
              color: "#111827",
              fontWeight: 900,
              cursor: !walletStr || !isSigned ? "not-allowed" : "pointer",
              opacity: !walletStr || !isSigned ? 0.6 : 1,
            }}
          >
            Review & Submit
          </button>

          <button
            type="button"
            onClick={onClearDraft}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Clear Draft
          </button>

          <a
            href="/profile"
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              textDecoration: "none",
              fontWeight: 900,
              color: "#111827",
            }}
          >
            View Profile
          </a>
        </div>

        {uiMsg && <div style={{ marginTop: 12, fontWeight: 800 }}>{uiMsg}</div>}

        {draft?.message && (
          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: "pointer", fontWeight: 900 }}>View signed message</summary>
            <pre
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#fafafa",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                fontSize: 12,
                lineHeight: 1.5,
              }}
            >
              {draft.message}
              {"\n\n"}
              Signature (base58): {draft.signature || "(none)"}
            </pre>
          </details>
        )}
      </section>

      <section style={{ marginTop: 16, padding: 14, border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 900 }}>Why approval?</h2>
        <div style={{ marginTop: 8, opacity: 0.85, lineHeight: 1.7 }}>
          Signature proves you controlled the wallet at the time of submission. Approval is the project’s decision
          to accept the contribution and issue points / reputation.
        </div>
      </section>
    </main>
  );
}
