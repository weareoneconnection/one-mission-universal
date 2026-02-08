"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

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

export default function ProjectMissionsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = String(params?.projectId || "");

  const [loading, setLoading] = useState(true);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // create form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState(10);

  // =========================
  // UI-only: mobile detection
  // =========================
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsMobile(!!mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  // ✅ Completed support (optional)
  const [wallet, setWallet] = useState<string>("");
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());

  // ✅ Fold state
  const [openActive, setOpenActive] = useState(true);
  const [openInactive, setOpenInactive] = useState(false);

  async function load() {
    if (!projectId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/missions?projectId=${encodeURIComponent(projectId)}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Failed to load missions");
      setMissions(data.missions || []);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!projectId) {
      setErr("Missing projectId in route. Please open from /projects and try again.");
      return;
    }

    try {
      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title,
          description: description.trim() || undefined,
          proofType: "SIGN_MESSAGE",
          weight: Number(weight),
          active: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        const msg =
          data?.error === "VALIDATION_ERROR"
            ? "Validation error. Check title/weight/projectId."
            : data?.message || data?.error || "Failed to create mission";
        throw new Error(msg);
      }

      setTitle("");
      setDescription("");
      setWeight(10);
      await load();
      // 创建后默认打开 Active
      setOpenActive(true);
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  async function toggleActive(id: string, active: boolean) {
    setErr(null);
    try {
      const res = await fetch("/api/missions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || "Failed to update mission");
      await load();
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  // ✅ load missions
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // ✅ load wallet from dashboard cache + completed missions
  useEffect(() => {
    try {
      const w = String(localStorage.getItem("one_wallet") || "").trim();
      setWallet(w);
      if (!w) return;

      (async () => {
        try {
          const pr = await fetch(
            `/api/profile/proofs?wallet=${encodeURIComponent(w)}`,
            { cache: "no-store" }
          ).then((r) => r.json());
          const list: Proof[] = Array.isArray(pr?.proofs) ? pr.proofs : [];
          const s = new Set<string>();
          for (const p of list) if (p?.missionId) s.add(String(p.missionId));
          setCompletedSet(s);
        } catch {
          // ignore
        }
      })();
    } catch {
      // ignore
    }
  }, []);

  // =========================
  // Derived
  // =========================
  const activeMissions = useMemo(() => missions.filter((m) => !!m.active), [missions]);
  const inactiveMissions = useMemo(() => missions.filter((m) => !m.active), [missions]);

  // =========================
  // UI helpers (no logic change)
  // =========================
  const styles = useMemo(() => {
    const page: React.CSSProperties = {
      padding: isMobile ? 14 : 24,
      maxWidth: 980,
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

    const card: React.CSSProperties = {
      marginTop: 18,
      padding: isMobile ? 14 : 16,
      border: "1px solid rgba(15,23,42,0.10)",
      borderRadius: isMobile ? 16 : 18,
      background: "white",
      boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
    };

    const titleH1: React.CSSProperties = {
      fontSize: isMobile ? 22 : 26,
      fontWeight: 950,
      margin: 0,
      letterSpacing: -0.2,
      lineHeight: 1.1,
      color: "#0f172a",
    };

    const sub: React.CSSProperties = {
      opacity: 0.78,
      marginTop: 8,
      fontSize: 13,
      lineHeight: 1.6,
      color: "#334155",
      wordBreak: "break-all",
      overflowWrap: "anywhere",
    };

    const navLinks: React.CSSProperties = {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: isMobile ? "flex-start" : "flex-end",
    };

    const link: React.CSSProperties = {
      textDecoration: "underline",
      fontWeight: 950,
      color: "#0f172a",
      fontSize: 13,
    };

    const label: React.CSSProperties = {
      fontWeight: 900,
      fontSize: 13,
      color: "#0f172a",
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

    const textarea: React.CSSProperties = {
      width: "100%",
      boxSizing: "border-box",
      padding: "12px 12px",
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,0.14)",
      outline: "none",
      background: "white",
      fontWeight: 650,
      lineHeight: 1.7,
      color: "#0f172a",
      resize: "vertical",
    };

    const hint: React.CSSProperties = {
      fontSize: 12,
      opacity: 0.75,
      lineHeight: 1.6,
      color: "#475569",
    };

    const btnPrimary: React.CSSProperties = {
      padding: "12px 14px",
      borderRadius: 14,
      border: "1px solid #0f172a",
      background: "#0f172a",
      color: "white",
      fontWeight: 950,
      cursor: "pointer",
      textAlign: "center",
      width: isMobile ? "100%" : 180,
      boxShadow: "0 10px 22px rgba(15,23,42,0.18)",
    };

    const btnGhost: React.CSSProperties = {
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,0.12)",
      background: "white",
      color: "#0f172a",
      fontWeight: 950,
      cursor: "pointer",
      textDecoration: "none",
      textAlign: "center",
      minWidth: 110,
      display: "inline-block",
    };

    const btnDo: React.CSSProperties = {
      ...btnPrimary,
      padding: "10px 12px",
      width: isMobile ? "100%" : 130,
      boxShadow: "0 10px 22px rgba(15,23,42,0.18)",
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

    const sectionTitle: React.CSSProperties = {
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "baseline",
      flexWrap: "wrap",
      marginTop: 18,
    };

    const listWrap: React.CSSProperties = {
      marginTop: 12,
      display: "grid",
      gap: 12,
    };

    const missionCard: React.CSSProperties = {
      padding: isMobile ? 12 : 14,
      border: "1px solid rgba(15,23,42,0.10)",
      borderRadius: 16,
      background: "rgba(255,255,255,0.96)",
      boxShadow: "0 8px 22px rgba(15,23,42,0.05)",
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

    const dot = (color: string): React.CSSProperties => ({
      width: 8,
      height: 8,
      borderRadius: 999,
      background: color,
      display: "inline-block",
    });

    const donePill: React.CSSProperties = {
      ...pill,
      background: "#f0fdf4",
      borderColor: "#bbf7d0",
      color: "#166534",
    };

    const activePill: React.CSSProperties = {
      ...pill,
      background: "#f0fdf4",
      borderColor: "#bbf7d0",
      color: "#166534",
    };

    const inactivePill: React.CSSProperties = {
      ...pill,
      background: "#fff7ed",
      borderColor: "#fed7aa",
      color: "#9a3412",
    };

    const foldWrap: React.CSSProperties = {
      border: "1px solid rgba(15,23,42,0.10)",
      borderRadius: 16,
      overflow: "hidden",
      background: "white",
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

    return {
      page,
      hero,
      card,
      titleH1,
      sub,
      navLinks,
      link,
      label,
      input,
      textarea,
      hint,
      btnPrimary,
      btnGhost,
      btnDo,
      errorBox,
      sectionTitle,
      listWrap,
      missionCard,
      pill,
      dot,
      donePill,
      activePill,
      inactivePill,
      foldWrap,
      foldBtn,
    };
  }, [isMobile]);

  if (!projectId) {
    return (
      <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Missing projectId</h1>
        <div style={{ marginTop: 8, opacity: 0.8 }}>
          You opened <code>/projects/[projectId]/missions</code> but the route param is empty.
        </div>
        <div style={{ marginTop: 16 }}>
          <a href="/projects" style={{ textDecoration: "underline" }}>
            Back to Projects
          </a>
        </div>
      </main>
    );
  }

  const renderMission = (m: Mission) => {
    const done = completedSet.has(m.id);

    return (
      <div key={m.id} style={styles.missionCard}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0, flex: "1 1 520px" }}>
            <div style={{ fontSize: 15, fontWeight: 950, color: "#0f172a", lineHeight: 1.25 }}>
              {m.title}
            </div>

            <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={styles.pill}>
                proof: <b style={{ marginLeft: 6 }}>{m.proofType}</b>
              </span>
              <span style={styles.pill}>
                weight: <b style={{ marginLeft: 6 }}>{m.weight}</b>
              </span>

              {m.active ? (
                <span style={styles.activePill}>
                  <span style={styles.dot("#22c55e")} />
                  active
                </span>
              ) : (
                <span style={styles.inactivePill}>
                  <span style={styles.dot("#f97316")} />
                  inactive
                </span>
              )}

              {wallet ? (
                done ? (
                  <span style={styles.donePill}>✓ Completed</span>
                ) : (
                  <span style={styles.pill}>Not completed</span>
                )
              ) : (
                <span style={styles.pill}>
                  Tip: connect wallet on{" "}
                  <a href="/dashboard" style={{ textDecoration: "underline", fontWeight: 950, color: "#0f172a" }}>
                    /dashboard
                  </a>{" "}
                  to show Completed
                </span>
              )}
            </div>

            <div style={styles.sub}>
              id: <span style={{ fontFamily: "monospace" }}>{m.id}</span>
            </div>

            {m.description && (
              <div style={{ marginTop: 10, fontSize: 14, color: "#0f172a", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                {m.description}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "row" : "column",
              gap: 10,
              alignItems: "stretch",
              width: isMobile ? "100%" : "auto",
            }}
          >
            {/* ✅ 入口按钮 */}
            <a href={`/missions/${m.id}`} style={done ? styles.btnGhost : styles.btnDo}>
              {done ? "Open" : "Do Mission"}
            </a>

            <button
              onClick={() => toggleActive(m.id, !m.active)}
              style={{
                ...styles.btnGhost,
                background: m.active ? "#fff7ed" : "#f0fdf4",
                borderColor: m.active ? "#fed7aa" : "#bbf7d0",
                color: m.active ? "#9a3412" : "#166534",
              }}
            >
              {m.active ? "Disable" : "Enable"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <main style={styles.page}>
      {/* Header */}
      <div
        style={{
          ...styles.hero,
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          alignItems: isMobile ? "flex-start" : "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 240, flex: "1 1 520px" }}>
          <h1 style={styles.titleH1}>Project Missions</h1>
          <div style={styles.sub}>projectId: {projectId}</div>
          <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span style={styles.pill}>{loading ? "Loading…" : `${missions.length} total`}</span>
            <span style={styles.pill}>{activeMissions.length} active</span>
            <span style={styles.pill}>{inactiveMissions.length} inactive</span>
            {wallet ? <span style={styles.pill}>wallet: {fmtShort(wallet, 6)}</span> : null}
          </div>
        </div>

        <div style={styles.navLinks}>
  <a href={`/projects/${projectId}`} style={styles.link}>
    Project
  </a>

  <a
  href={`/p/${projectId}/admin/reviews`}
  style={{
    ...styles.btnGhost,         // ✅ 直接用你现成的按钮样式
    textDecoration: "none",     // ✅ 去掉下划线，像按钮
    background: "#0f172a",      // ✅ 高对比，更显眼
    borderColor: "#0f172a",
    color: "white",
  }}
>
  Admin Reviews
</a>



  <a href="/missions" style={styles.link}>
    Mission Explore
  </a>
  <a href="/dashboard" style={styles.link}>
    Dashboard
  </a>
  <button onClick={load} style={styles.btnGhost}>
    Refresh
  </button>
</div>

      </div>

      {/* Create Mission */}
      <section style={styles.card}>
        <h2 style={{ fontSize: 16, fontWeight: 950, margin: 0, color: "#0f172a" }}>Create Mission</h2>

        <form onSubmit={onCreate} style={{ marginTop: 12, display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 8 }}>
            <label style={styles.label}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Follow X / Join Telegram / Retweet"
              style={styles.input}
            />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <label style={styles.label}>Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Keep it short and verifiable."
              rows={4}
              style={styles.textarea}
            />
          </div>

          <div style={{ display: "grid", gap: 8, maxWidth: isMobile ? "100%" : 280 }}>
            <label style={styles.label}>Weight</label>
            <input
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              type="number"
              min={1}
              max={100000}
              style={styles.input}
            />
            <div style={styles.hint}>MVP uses SIGN_MESSAGE proof only.</div>
          </div>

          <button
            type="submit"
            disabled={title.trim().length < 2}
            style={{ ...styles.btnPrimary, opacity: title.trim().length < 2 ? 0.6 : 1 }}
          >
            Create
          </button>

          {err && <div style={styles.errorBox}>{err}</div>}
        </form>
      </section>

      {/* Folded lists */}
      <section style={styles.sectionTitle}>
        <h2 style={{ fontSize: 16, fontWeight: 950, margin: 0, color: "#0f172a" }}>Missions</h2>
        <div style={{ fontSize: 12, opacity: 0.75, color: "#475569" }}>
          Fold by status for long lists
        </div>
      </section>

      {/* Active fold */}
      <div style={{ marginTop: 12, ...styles.foldWrap }}>
        <button onClick={() => setOpenActive((v) => !v)} style={styles.foldBtn}>
          <div>
            <div style={{ fontWeight: 950, color: "#0f172a" }}>Active Missions</div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75, color: "#475569" }}>
              {activeMissions.length} mission(s)
            </div>
          </div>
          <span style={styles.pill}>{openActive ? "Collapse" : "Expand"}</span>
        </button>

        {openActive && (
          <div style={{ padding: isMobile ? 12 : 14, borderTop: "1px solid rgba(15,23,42,0.08)" }}>
            {loading ? (
              <div style={{ opacity: 0.8 }}>Loading...</div>
            ) : activeMissions.length === 0 ? (
              <div style={{ opacity: 0.8 }}>No active missions.</div>
            ) : (
              <div style={styles.listWrap}>{activeMissions.map(renderMission)}</div>
            )}
          </div>
        )}
      </div>

      {/* Inactive fold */}
      <div style={{ marginTop: 12, ...styles.foldWrap }}>
        <button onClick={() => setOpenInactive((v) => !v)} style={styles.foldBtn}>
          <div>
            <div style={{ fontWeight: 950, color: "#0f172a" }}>Inactive Missions</div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75, color: "#475569" }}>
              {inactiveMissions.length} mission(s)
            </div>
          </div>
          <span style={styles.pill}>{openInactive ? "Collapse" : "Expand"}</span>
        </button>

        {openInactive && (
          <div style={{ padding: isMobile ? 12 : 14, borderTop: "1px solid rgba(15,23,42,0.08)" }}>
            {loading ? (
              <div style={{ opacity: 0.8 }}>Loading...</div>
            ) : inactiveMissions.length === 0 ? (
              <div style={{ opacity: 0.8 }}>No inactive missions.</div>
            ) : (
              <div style={styles.listWrap}>{inactiveMissions.map(renderMission)}</div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
