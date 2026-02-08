"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

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

type Proof = {
  id: string;
  missionId: string;
  projectId: string;
  userWallet: string;
  currentStatus: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
  createdAt: number;
  updatedAt?: number;
};

function short(s: string, n = 8) {
  if (!s) return "-";
  if (s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

export default function MissionsExplorePage() {
  const { publicKey, connected } = useWallet();
  const wallet = useMemo(() => (publicKey ? publicKey.toBase58() : ""), [publicKey]);

  const [loading, setLoading] = useState(true);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);

  const [q, setQ] = useState("");

  // completion status
  const [proofsLoading, setProofsLoading] = useState(false);
  const [proofs, setProofs] = useState<Proof[]>([]);

  // fold
  const [openProjects, setOpenProjects] = useState<Record<string, boolean>>({});

  async function loadMissions() {
    setLoading(true);
    setErr(null);
    try {
      const qs = activeOnly ? "?active=1" : "";
      const res = await fetch(`/api/missions${qs}`, { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Failed to load missions");
      setMissions(data.missions || []);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function loadProofs() {
    if (!wallet) {
      setProofs([]);
      return;
    }
    setProofsLoading(true);
    try {
      const res = await fetch(`/api/profile/proofs?wallet=${encodeURIComponent(wallet)}`, { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Failed to load proofs");
      setProofs(Array.isArray(data.proofs) ? data.proofs : []);
    } catch {
      setProofs([]);
    } finally {
      setProofsLoading(false);
    }
  }

  useEffect(() => {
    loadMissions();
  }, [activeOnly]);

  useEffect(() => {
    loadProofs();
  }, [wallet]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return missions;
    return missions.filter((m) => {
      return (
        (m.title || "").toLowerCase().includes(s) ||
        (m.description || "").toLowerCase().includes(s) ||
        (m.projectId || "").toLowerCase().includes(s) ||
        (m.id || "").toLowerCase().includes(s)
      );
    });
  }, [missions, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, Mission[]>();
    for (const m of filtered) {
      const key = m.projectId || "unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    const entries = Array.from(map.entries()).map(([pid, list]) => {
      const sorted = list.slice().sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
      return [pid, sorted] as const;
    });
    entries.sort((a, b) => {
      const aTop = (a[1][0]?.updatedAt || a[1][0]?.createdAt || 0) as number;
      const bTop = (b[1][0]?.updatedAt || b[1][0]?.createdAt || 0) as number;
      return bTop - aTop;
    });
    return entries;
  }, [filtered]);

  useEffect(() => {
    if (loading) return;
    if (grouped.length === 0) return;

    setOpenProjects((prev) => {
      const hasAny = Object.keys(prev || {}).length > 0;
      if (hasAny) return prev;

      const next: Record<string, boolean> = {};
      for (let i = 0; i < grouped.length; i++) next[grouped[i][0]] = i < 2;
      return next;
    });
  }, [loading, grouped]);

  const missionStatus = useMemo(() => {
    // priority: APPROVED > PENDING > REJECTED > REVOKED
    const rank: Record<string, number> = { APPROVED: 4, PENDING: 3, REJECTED: 2, REVOKED: 1 };
    const best = new Map<string, Proof["currentStatus"]>();

    for (const p of proofs) {
      const mid = p.missionId;
      if (!mid) continue;
      const prev = best.get(mid);
      if (!prev) best.set(mid, p.currentStatus);
      else if ((rank[p.currentStatus] || 0) > (rank[prev] || 0)) best.set(mid, p.currentStatus);
    }
    return best;
  }, [proofs]);

  function openAll(open: boolean) {
    const next: Record<string, boolean> = {};
    for (const [pid] of grouped) next[pid] = open;
    setOpenProjects(next);
  }

  // =========================
  // Styles
  // =========================
  const pageWrap: React.CSSProperties = { padding: 24, maxWidth: 1040, margin: "0 auto", boxSizing: "border-box" };

  const topCard: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
    background:
      "radial-gradient(900px 280px at 20% 0%, rgba(17,24,39,0.08), transparent), radial-gradient(700px 240px at 90% 10%, rgba(17,24,39,0.05), transparent), #fff",
    boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
  };

  const btnGhost: React.CSSProperties = {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid #e5e7eb",
    background: "white",
    color: "#111827",
    fontWeight: 950,
    cursor: "pointer",
    textDecoration: "none",
  };

  const input: React.CSSProperties = {
    width: "100%",
    padding: "11px 12px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    outline: "none",
    background: "white",
    fontWeight: 750,
    boxSizing: "border-box",
  };

  const badge: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontWeight: 950,
    fontSize: 12,
    whiteSpace: "nowrap",
  };

  function cta(kind: "START" | "PENDING" | "APPROVED" | "REJECTED" | "DISABLED", text: string) {
    const base: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid #e5e7eb",
      fontSize: 13,
      fontWeight: 950,
      userSelect: "none",
      whiteSpace: "nowrap",
      textDecoration: "none",
    };
    if (kind === "START") return <span style={{ ...base, background: "#111827", color: "white", borderColor: "#111827" }}>{text}</span>;
    if (kind === "PENDING") return <span style={{ ...base, background: "#fffbeb", color: "#92400e", borderColor: "#fde68a" }}>{text}</span>;
    if (kind === "APPROVED") return <span style={{ ...base, background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }}>{text}</span>;
    if (kind === "REJECTED") return <span style={{ ...base, background: "#fff1f2", color: "#991b1b", borderColor: "#fecaca" }}>{text}</span>;
    return <span style={{ ...base, background: "#f9fafb", color: "#6b7280", borderColor: "#e5e7eb" }}>{text}</span>;
  }

  return (
    <main style={pageWrap}>
      {/* Hero */}
      <section style={topCard}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ minWidth: 260, flex: "1 1 620px" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={badge}>Mission Library</span>
              <span style={{ fontSize: 12, opacity: 0.75 }}>
                {connected && wallet ? (
                  <>
                    Wallet <code style={{ padding: "4px 8px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#f9fafb", fontWeight: 800 }}>{short(wallet, 10)}</code>
                    {proofsLoading && <span style={{ marginLeft: 8 }}>checking…</span>}
                  </>
                ) : (
                  <>Connect wallet to show Completed / Submitted status</>
                )}
              </span>
            </div>

            <h1 style={{ marginTop: 12, fontSize: 34, fontWeight: 950, lineHeight: 1.08, letterSpacing: -0.4 }}>
              Missions
            </h1>

            <div style={{ marginTop: 10, opacity: 0.82, lineHeight: 1.6 }}>
              Browse missions across all projects. Clear CTA, scoped by wallet, and fold by project for scale.
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", fontWeight: 900, fontSize: 13 }}>
                <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
                Active only
              </label>

              <button onClick={() => openAll(true)} style={btnGhost}>Expand all</button>
              <button onClick={() => openAll(false)} style={btnGhost}>Collapse all</button>

              <a href="/projects" style={btnGhost}>Projects</a>
              <a href="/dashboard" style={btnGhost}>Dashboard</a>
            </div>

            <div style={{ marginTop: 12 }}>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search mission title / description / project / id…" style={input} />
            </div>

            {err && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #fecaca", background: "#fff1f2", color: "#991b1b", fontWeight: 900 }}>
                {err}
              </div>
            )}
          </div>

          <div style={{ flex: "0 0 320px", minWidth: 260 }}>
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 18, padding: 14, background: "white" }}>
              <div style={{ fontWeight: 950 }}>Tips</div>
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8, lineHeight: 1.65 }}>
                • Use <b>Start</b> to open the mission page and submit proof.<br />
                • <b>Submitted</b> = pending review.<br />
                • <b>Completed</b> = approved (earned).<br />
                • Fold by project keeps the library scalable.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* List */}
      <section style={{ marginTop: 16 }}>
        {loading ? (
          <div style={{ marginTop: 14, opacity: 0.8 }}>Loading missions…</div>
        ) : filtered.length === 0 ? (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: "1px dashed #e5e7eb", opacity: 0.85 }}>
            No missions found.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {grouped.map(([pid, list]) => {
              const open = !!openProjects[pid];
              const activeCount = list.filter((m) => m.active).length;

              return (
                <details
                  key={pid}
                  open={open}
                  onToggle={(e) => {
                    const el = e.currentTarget as HTMLDetailsElement;
                    setOpenProjects((prev) => ({ ...(prev || {}), [pid]: el.open }));
                  }}
                  style={{ border: "1px solid #e5e7eb", borderRadius: 18, background: "white", overflow: "hidden" }}
                >
                  <summary
                    style={{
                      listStyle: "none",
                      cursor: "pointer",
                      padding: 14,
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      alignItems: "center",
                      userSelect: "none",
                      background: "linear-gradient(180deg, #fff, #fafafa)",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 950, fontSize: 15 }}>
                        Project <span style={{ fontFamily: "monospace" }}>{short(pid, 10)}</span>
                      </div>
                      <div style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>
                        {list.length} mission(s) · {activeCount} active
                      </div>
                    </div>
                    <span style={badge}>{open ? "Collapse" : "Expand"}</span>
                  </summary>

                  <div style={{ padding: 14, paddingTop: 0, display: "grid", gap: 12 }}>
                    {list.map((m) => {
                      const st = missionStatus.get(m.id);
                      let kind: "START" | "PENDING" | "APPROVED" | "REJECTED" | "DISABLED" = "START";
                      let text = "Start";

                      if (connected && wallet) {
                        if (st === "APPROVED") { kind = "APPROVED"; text = "Completed"; }
                        else if (st === "PENDING") { kind = "PENDING"; text = "Submitted"; }
                        else if (st === "REJECTED") { kind = "REJECTED"; text = "Rejected"; }
                        else if (st === "REVOKED") { kind = "DISABLED"; text = "Revoked"; }
                      }

                      const isDisabled = kind === "DISABLED";
                      const href = `/missions/${m.id}`;

                      return (
                        <div
                          key={m.id}
                          style={{
                            padding: 16,
                            border: "1px solid #e5e7eb",
                            borderRadius: 16,
                            background: "white",
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 14,
                            alignItems: "flex-start",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ minWidth: 0, flex: "1 1 620px" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                              <div style={{ fontSize: 16, fontWeight: 950, lineHeight: 1.3, wordBreak: "break-word" }}>{m.title}</div>
                              <span
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: 999,
                                  border: "1px solid #e5e7eb",
                                  fontSize: 12,
                                  fontWeight: 900,
                                  background: m.active ? "#f0fdf4" : "#f9fafb",
                                  color: m.active ? "#166534" : "#374151",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {m.active ? "ACTIVE" : "INACTIVE"}
                              </span>
                            </div>

                            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.82, lineHeight: 1.6, wordBreak: "break-all" }}>
                              proof: {m.proofType} · weight: {m.weight} · project: {short(m.projectId, 10)}
                            </div>

                            {m.description && (
                              <div style={{ marginTop: 10, fontSize: 14, opacity: 0.92, lineHeight: 1.7 }}>
                                {m.description}
                              </div>
                            )}

                            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 900, opacity: 0.55 }}>
                              Tap the button to view & submit proof →
                            </div>
                          </div>

                          <div style={{ flexShrink: 0, display: "flex", alignItems: "center" }}>
                            {isDisabled ? (
                              cta(kind, text)
                            ) : (
                              <a href={href} style={{ textDecoration: "none" }}>
                                {cta(kind, text)}
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
