"use client";

import React, { useEffect, useMemo, useState } from "react";

/* ================= Types ================= */

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

/* ================= Utils ================= */

function fmtShort(s: string, n = 6) {
  if (!s) return "";
  if (s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

/* ================= Page ================= */

export default function MissionsExplorePage() {
  const [loading, setLoading] = useState(true);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);

  /* ---------- mobile detect ---------- */
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  /* ---------- wallet status ---------- */
  const [wallet, setWallet] = useState("");
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());

  const [q, setQ] = useState("");

  /* ================= Load missions ================= */

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

  /* ---------- load wallet proofs ---------- */
  useEffect(() => {
    try {
      const w = String(localStorage.getItem("one_wallet") || "").trim();
      setWallet(w);
      if (!w) return;

      (async () => {
        const pr = await fetch(`/api/profile/proofs?wallet=${encodeURIComponent(w)}`, {
          cache: "no-store",
        }).then((r) => r.json());

        const done = new Set<string>();
        const pend = new Set<string>();

        for (const p of pr?.proofs || []) {
          if (p.currentStatus === "APPROVED") done.add(p.missionId);
          else if (p.currentStatus === "PENDING") pend.add(p.missionId);
        }

        setCompleted(done);
        setPending(pend);
      })();
    } catch {}
  }, []);

  /* ================= Derived ================= */

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return missions;
    return missions.filter((m) =>
      `${m.title} ${m.description || ""}`.toLowerCase().includes(qq)
    );
  }, [missions, q]);

  const byProject = useMemo(() => {
    const map = new Map<string, Mission[]>();
    for (const m of filtered) {
      const pid = String(m.projectId || "unknown");
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(m);
    }
    return Array.from(map.entries());
  }, [filtered]);

  /* ================= UI ================= */

  const styles = {
    page: {
      padding: isMobile ? 14 : 24,
      maxWidth: 1100,
      margin: "0 auto",
      paddingBottom: 80,
    },
    hero: {
      borderRadius: 20,
      padding: isMobile ? 14 : 18,
      border: "1px solid rgba(15,23,42,0.1)",
      background: "#fff",
      boxShadow: "0 12px 36px rgba(15,23,42,.08)",
    },
    h1: {
      fontSize: isMobile ? 26 : 34,
      fontWeight: 950,
      margin: 0,
    },
    sub: {
      marginTop: 8,
      fontSize: 13,
      opacity: 0.75,
      lineHeight: 1.6,
    },
    pill: {
      padding: "6px 10px",
      borderRadius: 999,
      border: "1px solid rgba(15,23,42,.12)",
      fontSize: 12,
      fontWeight: 900,
      background: "#f8fafc",
    },
    btn: {
      padding: "12px 14px",
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,.12)",
      background: "white",
      fontWeight: 950,
      textAlign: "center" as const,
    },
    btnPrimary: {
      padding: "12px 14px",
      borderRadius: 14,
      background: "#0f172a",
      color: "white",
      fontWeight: 950,
      textAlign: "center" as const,
    },
    input: {
      width: "100%",
      padding: "12px",
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,.14)",
      fontWeight: 700,
    },
    card: {
      marginTop: 14,
      padding: 14,
      borderRadius: 16,
      border: "1px solid rgba(15,23,42,.1)",
      background: "white",
    },
    mission: {
      padding: 14,
      borderRadius: 16,
      border: "1px solid rgba(15,23,42,.1)",
      background: "#fff",
    },
  } as const;

  /* ================= Render ================= */

  return (
    <main style={styles.page}>
      {/* ---------- Hero ---------- */}
      <div style={styles.hero}>
        <h1 style={styles.h1}>Missions</h1>
        <div style={styles.sub}>
          Browse missions across all projects. Clear CTA, mobile-first, scalable.
        </div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={styles.pill}>
            {loading ? "Loading…" : `${filtered.length} missions`}
          </span>
          <span style={styles.pill}>
            wallet: {wallet ? fmtShort(wallet) : "not connected"}
          </span>
        </div>

        {/* Controls */}
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "auto auto auto auto",
            gap: 10,
          }}
        >
          <label style={{ gridColumn: isMobile ? "1 / -1" : undefined }}>
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />{" "}
            Active only
          </label>

          <a href="/projects" style={styles.btn}>
            Projects
          </a>
          <a href="/dashboard" style={styles.btn}>
            Dashboard
          </a>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search missions"
            style={{ ...styles.input, gridColumn: isMobile ? "1 / -1" : undefined }}
          />
        </div>
      </div>

      {err && <div style={{ marginTop: 12, color: "#b91c1c" }}>{err}</div>}

      {/* ---------- Missions ---------- */}
      <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
        {byProject.map(([pid, list]) => (
          <div key={pid} style={styles.card}>
            <div style={{ fontWeight: 950, marginBottom: 10 }}>
              Project {fmtShort(pid, 8)}
            </div>

            <div style={{ display: "grid", gap: 12 }}>
              {list.map((m) => {
                const done = completed.has(m.id);
                const pend = pending.has(m.id);

                return (
                  <div key={m.id} style={styles.mission}>
                    <div style={{ fontWeight: 950 }}>{m.title}</div>

                    {m.description && (
                      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
                        {m.description}
                      </div>
                    )}

                    <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <span style={styles.pill}>weight {m.weight}</span>
                      <span style={styles.pill}>
                        {done ? "✓ Completed" : pend ? "Submitted" : "Not done"}
                      </span>
                    </div>

                    <a
                      href={`/missions/${m.id}`}
                      style={{
                        ...(done ? styles.btn : styles.btnPrimary),
                        marginTop: 10,
                        display: "block",
                        width: "100%",
                      }}
                    >
                      {done ? "Open" : "Start"}
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
