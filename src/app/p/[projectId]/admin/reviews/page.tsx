"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";

type Attachment = { name: string; type: string; size: number; url: string };

type ProofEvent = {
  id: string;
  type: string; // "SUBMITTED" | "APPROVED" | "REJECTED" | ...
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

export default function AdminReviewsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = String(params?.projectId || "");

  const { publicKey, connected } = useWallet();
  const adminWallet = useMemo(() => (publicKey ? publicKey.toBase58() : ""), [publicKey]);

  const [loading, setLoading] = useState(true);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    if (!projectId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/proofs?status=PENDING`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || `Failed to load (${res.status})`);
      }

      // ✅ 兜底：proofs 必须是数组，否则白屏
      const list = Array.isArray(data?.proofs) ? data.proofs : [];
      setProofs(list as Proof[]);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function decide(proofId: string, decision: "APPROVED" | "REJECTED") {
    setErr(null);

    if (!connected || !adminWallet) {
      setErr("Wallet not connected (admin).");
      return;
    }

    const pid = String(proofId || "").trim();

    if (!pid || !pid.startsWith("prf_")) {
      setErr(`Invalid proofId: "${pid}" (expected id starting with "prf_")`);
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
          "x-wallet": adminWallet, // ✅ 后端鉴权
        },
        body: JSON.stringify({
          proof_id: pid,
          note: reason || "",
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || `Decision failed (${res.status})`);
      }

      await load();
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 950 }}>Admin Reviews</h1>
          <div style={{ marginTop: 6, opacity: 0.75 }}>
            Project: <code>{projectId}</code>
          </div>
          <div style={{ marginTop: 6, opacity: 0.75 }}>
            Admin wallet:{" "}
            {adminWallet ? <code>{short(adminWallet, 8)}</code> : <span style={{ color: "#b91c1c" }}>not connected</span>}
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
            onClick={load}
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
              // ✅ 兜底：events 必须是数组，否则白屏
              const evts = Array.isArray(p.events) ? p.events : [];

              const submitted = evts.find((e) => e.type === "SUBMITTED");
              const payload = submitted?.payload || {};
              const links = Array.isArray(payload.links) ? payload.links : [];
              const note = typeof payload.note === "string" ? payload.note : "";

              // ✅ 兜底：attachments 必须是数组，并且必须有 url
              const attsRaw = Array.isArray(payload.attachments) ? payload.attachments : [];
              const atts = attsRaw.filter((a: any) => a && typeof a.url === "string" && a.url.length > 0) as Attachment[];

              const submittedAt = submitted?.at || p.createdAt;

              return (
                <div
                  key={p.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    padding: 16,
                    background: "white",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 950 }}>
                        Mission <code>{p.missionId}</code>
                      </div>
                      <div style={{ marginTop: 6, opacity: 0.8 }}>
                        Proof <code>{p.id}</code> · User <code>{short(p.userWallet, 8)}</code> · Status{" "}
                        <span style={{ fontWeight: 900, color: "#b45309" }}>PENDING</span>
                      </div>
                      <div style={{ marginTop: 6, opacity: 0.7, fontSize: 12 }}>Submitted at: {fmtTime(submittedAt)}</div>
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
                          cursor: busyId === p.id ? "not-allowed" : "pointer",
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
                          cursor: busyId === p.id ? "not-allowed" : "pointer",
                        }}
                      >
                        {busyId === p.id ? "..." : "Reject"}
                      </button>
                    </div>
                  </div>

                  {(links.length > 0 || note || atts.length > 0) && (
                    <div style={{ marginTop: 14, borderTop: "1px dashed #e5e7eb", paddingTop: 14 }}>
                      {links.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontWeight: 900, marginBottom: 6 }}>Links</div>
                          <ul style={{ margin: 0, paddingLeft: 18 }}>
                            {links.map((u, i) => (
                              <li key={i}>
                                <a href={u} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                                  {u}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {note && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontWeight: 900, marginBottom: 6 }}>Note</div>
                          <div style={{ opacity: 0.9, whiteSpace: "pre-wrap" }}>{note}</div>
                        </div>
                      )}

                      {atts.length > 0 && (
                        <div>
                          <div style={{ fontWeight: 900, marginBottom: 6 }}>Attachments</div>
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                            {atts.map((a, i) => (
                              <div key={i} style={{ border: "1px solid #eee", borderRadius: 12, padding: 10 }}>
                                <div style={{ fontSize: 12, opacity: 0.7 }}>{a.name}</div>
                                <img src={a.url} alt={a.name} style={{ width: 240, borderRadius: 10, marginTop: 8 }} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {p.message && (
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
                        {p.message}
                        {"\n\n"}
                        Signature: {p.signature}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={{ marginTop: 16, opacity: 0.75 }}>
        Decisions are recorded as immutable Proof Events (append-only). Approve/Reject will change the derived status.
      </section>
    </main>
  );
}
