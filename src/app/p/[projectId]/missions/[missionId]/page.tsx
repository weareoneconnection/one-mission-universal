"use client";

import React, { useEffect, useMemo, useState } from "react";

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
  currentStatus?: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
};

function fmtShort(s: string, n = 6) {
  if (!s) return "";
  if (s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

export default function MissionsExplorePage() {
  const [loading, setLoading] = useState(true);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);

  // Mobile detect
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsMobile(!!mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  // wallet completion (optional)
  const [wallet, setWallet] = useState<string>("");
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());

  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const qs = activeOnly ? "?active=1" : "";
      const res = await fetch(`/api/missions${qs}`, { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Failed to load missions");
      setMissions(Array.isArray(data.missions) ? data.missions : []);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [activeOnly]);

  // load wallet + proofs
  useEffect(() => {
    try {
      const w = String(localStorage.getItem("one_wallet") || "").trim();
      setWallet(w);
      if (!w) return;

      (async () => {
        try {
          const pr = await fetch(`/api/profile/proofs?wallet=${encodeURIComponent(w)}`, { cache: "no-store" }).then((r) =>
            r.json()
          );
          const list: Proof[] = Array.isArray(pr?.proofs) ? pr.proofs : [];
          const done = new Set<string>();
          const pend = new Set<string>();
          for (const p of list) {
            if (!p?.missionId) continue;
            const mid = String(p.missionId);
            if (p.currentStatus === "APPROVED") done.add(mid);
            else if (p.currentStatus === "PENDING") pend.add(mid);
          }
          setCompleted(done);
          setPending(pend);
        } catch {
          // ignore
        }
      })();
    } catch {
      // ignore
    }
  }, []);

  // styles
  const styles = useMemo(() => {
    const page: React.CSSProperties = {
      padding: isMobile ? 14 : 24,
      maxWidth: 1100,
      margin: "0 auto",
      boxSizing: "border-box",
      paddingBottom: 80,
    };

    const hero: React.CSSProperties = {
      borderRadius: isMobile ? 18 : 22,
      padding: isMobile ? 14 : 18,
      border: "1px solid rgba(15,23,42,0.10)",
      background:
        "radial-gradient(900px 320px at 20% 0%, rgba(15,23,42,0.10), transparent), radial-gradient(700px 260px at 90% 20%, rgba(15,23,42,0.06), transparent), linear-gradient(#ffffff, #ffffff)",
      boxShadow: "0 14px 45px rgba(15, 23, 42, 0.07)",
    };

    const h1: React.CSSProperties = {
      fontSize: isMobile ? 26 : 34,
      fontWeight: 950,
      margin: 0,
      letterSpacing: -0.3,
      lineHeight: 1.05,
      color: "#0f172a",
    };

    const sub: React.CSSProperties = {
      marginTop: 8,
      opacity: 0.78,
      fontSize: 13,
      lineHeight: 1.6,
      color: "#334155",
    };

    const pill: React.CSSProperties = {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid rgba(15,23,42,0.12)",
      fontSize: 12,
      fontWeight: 950,
      background: "#f8fafc",
      color: "#0f172a",
      whiteSpace: "nowrap",
    };

    const btn: React.CSSProperties = {
      padding: "12px 14px",
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,0.12)",
      background: "white",
      color: "#0f172a",
      fontWeight: 950,
      cursor: "pointer",
      textDecoration: "none",
      textAlign: "center",
      display: "inline-block",
    };

    const btnPrimary: React.CSSProperties = {
      ...btn,
      border: "1px solid #0f172a",
      background: "#0f172a",
      color: "white",
      boxShadow: "0 10px 22px rgba(15,23,42,0.18)",
    };

    const input: React.CSSProperties = {
      width: "100%",
      boxSizing: "border-box",
      padding: "12px 12px",
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,0.14)",
      outline: "none",
      background: "white",
      fontWeight: 750,
      color: "#0f172a",
    };

    const errorBox: React.CSSProperties = {
      marginTop: 12,
      padding: 12,
      borderRadius: 14,
      border: "1px solid #fecaca",
      background: "#fef2f2",
      color: "#991b1b",
      fontWeight: 900,
      lineHeight: 1.5,
    };

    const card: React.CSSProperties = {
      marginTop: 14,
      padding: isMobile ? 12 : 14,
      border: "1px solid rgba(15,23,42,0.10)",
      borderRadius: 16,
      background: "white",
      boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
    };

    const foldWrap: React.CSSProperties = {
      border: "1px solid rgba(15,23,42,0.10)",
      borderRadius: 16,
      overflow: "hidden",
      background: "white",
      boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
    };

    const foldBtn: React.CSSProperties = {
      width: "100%",
      textAlign: "left",
      padding: isMobile ? 12 : 14,
      border: "none",
      background: "linear-gradient(#ffffff, #ffffff)",
      cursor: "pointer",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
    };

    const dot = (color: string): React.CSSProperties => ({
      width: 8,
      height: 8,
      borderRadius: 999,
      background: color,
      display: "inline-block",
    });

    const statusPill = (bg: string, bd: string, fg: string): React.CSSProperties => ({
      ...pill,
      background: bg,
      borderColor: bd,
      color: fg,
    });

    return { page, hero, h1, sub, pill, btn, btnPrimary, input, errorBox, card, foldWrap, foldBtn, dot, statusPill };
  }, [isMobile]);

  // group by project
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return missions;
    return missions.filter((m) => {
      const t = `${m.title || ""} ${m.description || ""}`.toLowerCase();
      return t.includes(qq);
    });
  }, [missions, q]);

  const byProject = useMemo(() => {
    const map = new Map<string, Mission[]>();
    for (const m of filtered) {
      const pid = String(m.projectId || "unknown");
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(m);
    }
    // stable
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  // fold state per project
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  useEffect(() => {
    // 初次加载：默认展开第一个项目，其他折叠（手机更清爽）
    if (byProject.length === 0) return;
    setOpenMap((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const first = byProject[0][0];
      return { [first]: true };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byProject.length]);

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    for (const [pid] of byProject) next[pid] = true;
    setOpenMap(next);
  };
  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    for (const [pid] of byProject) next[pid] = false;
    setOpenMap(next);
  };

  const renderMission = (m: Mission) => {
    const isDone = completed.has(m.id);
    const isPending = pending.has(m.id);

    const status =
      isDone ? styles.statusPill("#f0fdf4", "#bbf7d0", "#166534") :
      isPending ? styles.statusPill("#fff7ed", "#fed7aa", "#9a3412") :
      styles.pill;

    const statusText = isDone ? "Completed" : isPending ? "Submitted" : "Not done";

    return (
      <div
        key={m.id}
        style={{
          padding: isMobile ? 12 : 14,
          border: "1px solid rgba(15,23,42,0.10)",
          borderRadius: 16,
          background: "rgba(255,255,255,0.96)",
          boxShadow: "0 8px 22px rgba(15,23,42,0.05)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ minWidth: 0, flex: "1 1 520px" }}>
            <div style={{ fontSize: 15, fontWeight: 950, color: "#0f172a", lineHeight: 1.25 }}>{m.title}</div>

            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={styles.pill}>proof: <b>{m.proofType}</b></span>
              <span style={styles.pill}>weight: <b>{m.weight}</b></span>
              <span style={m.active ? styles.statusPill("#f0fdf4", "#bbf7d0", "#166534") : styles.statusPill("#fff7ed", "#fed7aa", "#9a3412")}>
                <span style={styles.dot(m.active ? "#22c55e" : "#f97316")} />
                {m.active ? "active" : "inactive"}
              </span>
              {wallet ? <span style={status}>{isDone ? "✓ " : ""}{statusText}</span> : (
                <span style={styles.pill}>
                  Connect wallet in <a href="/dashboard" style={{ fontWeight: 950, textDecoration: "underline", color: "#0f172a" }}>/dashboard</a>
                </span>
              )}
            </div>

            {m.description && (
              <div style={{ marginTop: 10, fontSize: 14, color: "#0f172a", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {m.description}
              </div>
            )}
          </div>

          <div
            style={{
              width: isMobile ? "100%" : "auto",
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              justifyContent: isMobile ? "stretch" : "flex-end",
            }}
          >
            <a
              href={`/missions/${m.id}`}
              style={{
                ...(isDone ? styles.btn : styles.btnPrimary),
                width: isMobile ? "100%" : "auto",
              }}
            >
              {isDone ? "Open" : "Start"}
            </a>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main style={styles.page}>
      {/* Header */}
      <div style={styles.hero}>
        <h1 style={styles.h1}>Missions</h1>
        <div style={styles.sub}>
          Browse missions across all projects. Clear CTA, scoped by wallet, and fold by project for scale.
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={styles.pill}>{loading ? "Loading…" : `${filtered.length} mission(s)`}</span>
          {wallet ? <span style={styles.pill}>wallet: {fmtShort(wallet, 6)}</span> : <span style={styles.pill}>wallet: not connected</span>}
        </div>

        {/* Controls (mobile: 2 columns grid, desktop: inline) */}
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gap: 10,
            gridTemplateColumns: isMobile ? "1fr 1fr" : "auto auto auto auto",
            alignItems: "center",
          }}
        >
          <label
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              cursor: "pointer",
              fontWeight: 950,
              color: "#0f172a",
              fontSize: 13,
              gridColumn: isMobile ? "1 / -1" : undefined,
            }}
          >
            <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
            Active only
          </label>

          <button onClick={expandAll} style={{ ...styles.btn, width: "100%" }}>
            Expand all
          </button>
          <button onClick={collapseAll} style={{ ...styles.btn, width: "100%" }}>
            Collapse all
          </button>

          <a href="/projects" style={{ ...styles.btn, width: "100%" }}>
            Projects
          </a>
          <a href="/dashboard" style={{ ...styles.btn, width: "100%" }}>
            Dashboard
          </a>

          <div style={{ gridColumn: isMobile ? "1 / -1" : "auto", width: "100%" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search mission title / description"
              style={styles.input}
            />
          </div>
        </div>

        {/* Tips */}
        <div style={styles.card}>
          <div style={{ fontWeight: 950, color: "#0f172a" }}>Tips</div>
          <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75, color: "#334155", lineHeight: 1.7 }}>
            • Use <b>Start</b> to open the mission page and submit proof.<br />
            • <b>Submitted</b> = pending review.<br />
            • <b>Completed</b> = approved (earned).<br />
            • Fold by project keeps the library scalable.
          </div>
        </div>
      </div>

      {err && <div style={styles.errorBox}>{err}</div>}

      {/* Fold by project */}
      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        {loading ? (
          <div style={{ opacity: 0.8 }}>Loading...</div>
        ) : byProject.length === 0 ? (
          <div style={{ opacity: 0.8 }}>No missions found.</div>
        ) : (
          byProject.map(([pid, list]) => {
            const open = !!openMap[pid];
            const activeCount = list.filter((m) => m.active).length;

            return (
              <div key={pid} style={styles.foldWrap}>
                <button
                  onClick={() => setOpenMap((prev) => ({ ...prev, [pid]: !prev[pid] }))}
                  style={styles.foldBtn}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 950, color: "#0f172a" }}>Project</div>
                    <div style={{ marginTop: 6, fontSize: 14, fontWeight: 950, color: "#0f172a", wordBreak: "break-all" }}>
                      {pid}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75, color: "#475569" }}>
                      {list.length} mission(s) · {activeCount} active
                    </div>
                  </div>

                  <span style={styles.pill}>{open ? "Collapse" : "Expand"}</span>
                </button>

                {open && (
                  <div style={{ padding: isMobile ? 12 : 14, borderTop: "1px solid rgba(15,23,42,0.08)" }}>
                    <div style={{ display: "grid", gap: 12 }}>{list.map(renderMission)}</div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
