"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";

/* =========================
   Types
========================= */

type Attachment = { name: string; type: string; size: number; url: string };

type ProofEvent = {
  id: string;
  type: string;
  at: number;
  by: string;
  reason?: string;
  payload?: {
    links?: string[];
    note?: string;
    attachments?: Attachment[];
  };
};

type Proof = {
  id: string;
  projectId: string;
  missionId: string;
  userWallet: string;
  signature: string;
  message?: string;
  createdAt: number;
  currentStatus: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
  events: ProofEvent[];
};

type Project = {
  id: string;
  ownerWallet: string;
};

/* =========================
   Utils
========================= */

function short(s: string, n = 6) {
  if (!s) return "";
  if (s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}...${s.slice(-n)}`;
}

function fmtTime(ms?: number) {
  if (!ms) return "-";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

/* =========================
   Page
========================= */

export default function AdminReviewsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = String(params?.projectId || "");

  const { publicKey, connected } = useWallet();
  const wallet = useMemo(() => (publicKey ? publicKey.toBase58() : ""), [publicKey]);

  const [projectOwner, setProjectOwner] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isOwner = useMemo(
    () => connected && wallet && projectOwner && wallet === projectOwner,
    [connected, wallet, projectOwner]
  );

  /* =========================
     Load project owner
  ========================= */

  async function loadOwner() {
    if (!projectId) return;
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) return;

      const list: Project[] = Array.isArray(data.projects) ? data.projects : [];
      const p = list.find((x) => String(x.id) === projectId);
      setProjectOwner(String(p?.ownerWallet || ""));
    } catch {
      // ignore
    }
  }

  /* =========================
     Load proofs (owner only)
  ========================= */

  async function loadProofs() {
    if (!projectId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/proofs?status=PENDING`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || `Failed to load (${res.status})`);
      }

      setProofs(Array.isArray(data.proofs) ? data.proofs : []);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOwner();
  }, [projectId]);

  useEffect(() => {
    if (isOwner) loadProofs();
  }, [isOwner]);

  /* =========================
     Decide
  ========================= */

  async function decide(proofId: string, decision: "APPROVED" | "REJECTED") {
    setErr(null);

    if (!isOwner) {
      setErr("Only project owner can review proofs.");
      return;
    }

    const pid = String(proofId || "").trim();
    if (!pid.startsWith("prf_")) {
      setErr(`Invalid proofId: ${pid}`);
      return;
    }

    const reason = window.prompt(
      decision === "APPROVED" ? "Approval note (optional):" : "Rejection reason (recommended):",
      ""
    );

    setBusyId(pid);
    try {
      const action = decision === "APPROVED" ? "approve" : "reject";
      const endpoint = `/api/proofs/${encodeURIComponent(pid)}/${action}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet": wallet,
        },
        body: JSON.stringify({ proof_id: pid, note: reason || "" }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || `Decision failed (${res.status})`);
      }

      await loadProofs();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusyId(null);
    }
  }

  /* =========================
     Guards
  ========================= */

  if (!connected || !wallet) {
    return (
      <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 950 }}>Admin Reviews</h1>
        <div style={{ marginTop: 12, fontWeight: 900, color: "#b91c1c" }}>
          Wallet not connected.
        </div>
        <div style={{ marginTop: 8 }}>
          Connect wallet in <a href="/dashboard">/dashboard</a>
        </div>
      </main>
    );
  }

  if (projectOwner && !isOwner) {
    return (
      <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 26, fontWeight: 950 }}>Admin Reviews</h1>

        <div
          style={{
            marginTop: 16,
            padding: 16,
            borderRadius: 14,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#991b1b",
            fontWeight: 900,
          }}
        >
          Access denied.
          <div style={{ marginTop: 6 }}>
            This page is restricted to the project owner.
          </div>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            Owner wallet: <code>{short(projectOwner, 8)}</code>
          </div>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            Your wallet: <code>{short(wallet, 8)}</code>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <a href={`/projects/${projectId}`}>← Back to Project</a>
        </div>
      </main>
    );
  }

  /* =========================
     Owner View (原页面结构)
  ========================= */

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 950 }}>Admin Reviews</h1>
          <div style={{ marginTop: 6, opacity: 0.75 }}>
            Project: <code>{projectId}</code>
          </div>
          <div style={{ marginTop: 6, opacity: 0.75 }}>
            Admin wallet: <code>{short(wallet, 8)}</code>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <a
            href={`/p/${projectId}/missions`}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              textDecoration: "none",
              fontWeight: 900,
              color: "#111",
            }}
          >
            Project Missions
          </a>
          <button
            onClick={loadProofs}
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      </header>

      {err && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#b91c1c",
            fontWeight: 800,
          }}
        >
          {err}
        </div>
      )}

      <section style={{ marginTop: 16 }}>
        {loading ? (
          <div style={{ fontWeight: 900 }}>Loading...</div>
        ) : proofs.length === 0 ? (
          <div style={{ opacity: 0.8 }}>No pending proofs.</div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {proofs.map((p) => {
              const evts = Array.isArray(p.events) ? p.events : [];
              const submitted = evts.find((e) => e.type === "SUBMITTED");
              const payload = submitted?.payload || {};
              const links = Array.isArray(payload.links) ? payload.links : [];
              const note = typeof payload.note === "string" ? payload.note : "";
              const attsRaw = Array.isArray(payload.attachments) ? payload.attachments : [];
              const atts = attsRaw.filter((a: any) => a?.url) as Attachment[];
              const submittedAt = submitted?.at || p.createdAt;

              return (
                <div key={p.id} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 16, background: "white" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 950 }}>
                        Mission <code>{p.missionId}</code>
                      </div>
                      <div style={{ marginTop: 6, opacity: 0.8 }}>
                        Proof <code>{p.id}</code> · User <code>{short(p.userWallet, 8)}</code> ·{" "}
                        <span style={{ fontWeight: 900, color: "#b45309" }}>PENDING</span>
                      </div>
                      <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>
                        Submitted at: {fmtTime(submittedAt)}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        disabled={busyId === p.id}
                        onClick={() => decide(p.id, "APPROVED")}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid #16a34a",
                          background: busyId === p.id ? "#e5e7eb" : "#16a34a",
                          color: "white",
                          fontWeight: 900,
                        }}
                      >
                        {busyId === p.id ? "..." : "Approve"}
                      </button>

                      <button
                        disabled={busyId === p.id}
                        onClick={() => decide(p.id, "REJECTED")}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 12,
                          border: "1px solid #b91c1c",
                          background: busyId === p.id ? "#e5e7eb" : "#b91c1c",
                          color: "white",
                          fontWeight: 900,
                        }}
                      >
                        {busyId === p.id ? "..." : "Reject"}
                      </button>
                    </div>
                  </div>

                  {(links.length > 0 || note || atts.length > 0) && (
                    <div style={{ marginTop: 14, borderTop: "1px dashed #e5e7eb", paddingTop: 14 }}>
                      {links.length > 0 && (
                        <ul style={{ paddingLeft: 18 }}>
                          {links.map((u, i) => (
                            <li key={i}>
                              <a href={u} target="_blank" rel="noreferrer">
                                {u}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}

                      {note && <div style={{ whiteSpace: "pre-wrap" }}>{note}</div>}

                      {atts.length > 0 && (
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                          {atts.map((a, i) => (
                            <img key={i} src={a.url} alt={a.name} style={{ width: 240, borderRadius: 10 }} />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
