"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
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
  currentStatus?: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
};

type Project = {
  id: string;
  ownerWallet: string;
  name?: string;
};

function fmtShort(s: string, n = 6) {
  if (!s) return "";
  if (s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

export default function ProjectMissionsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = String(params?.projectId || "");

  // ✅ wallet adapter（用于 owner 判定）
  const { publicKey, connected } = useWallet();
  const connectedWallet = useMemo(() => (publicKey ? publicKey.toBase58() : ""), [publicKey]);

  const [loading, setLoading] = useState(true);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // ✅ project owner
  const [projectOwner, setProjectOwner] = useState<string>("");
  const isOwner = useMemo(() => {
    if (!connected || !connectedWallet || !projectOwner) return false;
    return connectedWallet === projectOwner;
  }, [connected, connectedWallet, projectOwner]);

  // create form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState(10);

  // UI-only: mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setIsMobile(!!mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  // ✅ Create fold (mobile default collapsed, desktop default open)
  const [openCreate, setOpenCreate] = useState(true);
  useEffect(() => {
    setOpenCreate((prev) => {
      if (typeof prev === "boolean") return isMobile ? false : true;
      return isMobile ? false : true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMobile]);

  // Completed support (optional)
  const [wallet, setWallet] = useState<string>("");
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());

  // Fold state
  const [openActive, setOpenActive] = useState(true);
  const [openInactive, setOpenInactive] = useState(false);

  async function loadProjectOwner() {
    if (!projectId) return;
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) return;

      const list: Project[] = Array.isArray(data.projects) ? data.projects : [];
      const p = list.find((x) => String(x?.id) === projectId);
      setProjectOwner(String(p?.ownerWallet || ""));
    } catch {
      // ignore
    }
  }

  async function load() {
    if (!projectId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/missions?projectId=${encodeURIComponent(projectId)}`, {
        cache: "no-store",
      });
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

    // ✅ owner-only
    if (!connected || !connectedWallet) {
      setErr("Connect wallet in /dashboard to create missions.");
      return;
    }
    if (!isOwner) {
      setErr("Owner only: only the project owner wallet can create missions.");
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

      // ✅ after create: open create + open active
      setOpenCreate(true);
      setOpenActive(true);
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  async function toggleActive(id: string, active: boolean) {
    setErr(null);

    // ✅ owner-only
    if (!connected || !connectedWallet) {
      setErr("Connect wallet in /dashboard to manage missions.");
      return;
    }
    if (!isOwner) {
      setErr("Owner only: only the project owner wallet can enable/disable missions.");
      return;
    }

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

  useEffect(() => {
    load();
    loadProjectOwner();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // 如果你想：连接钱包后也用 adapter 钱包展示 Completed，可以把 localStorage 那段保留，同时优先 adapter
  useEffect(() => {
    try {
      const w = String(localStorage.getItem("one_wallet") || "").trim();
      setWallet(w);
      if (!w) return;

      (async () => {
        try {
          const pr = await fetch(`/api/profile/proofs?wallet=${encodeURIComponent(w)}`, {
            cache: "no-store",
          }).then((r) => r.json());
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

  const activeMissions = useMemo(() => missions.filter((m) => !!m.active), [missions]);
  const inactiveMissions = useMemo(() => missions.filter((m) => !m.active), [missions]);

  const styles = useMemo(() => {
    const touchH = 48;

    const page: React.CSSProperties = {
      padding: isMobile ? 14 : 24,
      maxWidth: 980,
      margin: "0 auto",
      boxSizing: "border-box",
      paddingBottom: 84,
    };

    const hero: React.CSSProperties = {
      borderRadius: isMobile ? 18 : 22,
      padding: isMobile ? 14 : 18,
      border: "1px solid rgba(15,23,42,0.10)",
      background:
        "radial-gradient(900px 320px at 20% 0%, rgba(15,23,42,0.10), transparent), radial-gradient(700px 260px at 90% 20%, rgba(15,23,42,0.06), transparent), linear-gradient(#ffffff, #ffffff)",
      boxShadow: "0 14px 45px rgba(15, 23, 42, 0.07)",
      boxSizing: "border-box",
    };

    const titleH1: React.CSSProperties = {
      fontSize: isMobile ? 22 : 26,
      fontWeight: 950,
      margin: 0,
      letterSpacing: -0.2,
      lineHeight: 1.12,
      color: "#0f172a",
    };

    const sub: React.CSSProperties = {
      opacity: 0.78,
      marginTop: 8,
      fontSize: 13,
      lineHeight: 1.6,
      color: "#334155",
      wordBreak: "break-word",
      overflowWrap: "anywhere",
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
      boxSizing: "border-box",
    };

    const dot = (color: string): React.CSSProperties => ({
      width: 8,
      height: 8,
      borderRadius: 999,
      background: color,
      display: "inline-block",
      flex: "0 0 auto",
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

    const card: React.CSSProperties = {
      marginTop: 14,
      border: "1px solid rgba(15,23,42,0.10)",
      borderRadius: 16,
      background: "white",
      boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
      boxSizing: "border-box",
      overflow: "hidden",
    };

    const cardHeadBtn: React.CSSProperties = {
      width: "100%",
      textAlign: "left",
      padding: isMobile ? 14 : 16,
      border: "none",
      background: "linear-gradient(#ffffff, #ffffff)",
      cursor: "pointer",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      boxSizing: "border-box",
    };

    const cardBody: React.CSSProperties = {
      padding: isMobile ? 14 : 16,
      borderTop: "1px solid rgba(15,23,42,0.08)",
      boxSizing: "border-box",
    };

    const label: React.CSSProperties = {
      fontWeight: 900,
      fontSize: 13,
      color: "#0f172a",
    };

    const input: React.CSSProperties = {
      width: "100%",
      minHeight: touchH,
      boxSizing: "border-box",
      padding: "10px 12px",
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
      padding: "10px 12px",
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

    const btnBase: React.CSSProperties = {
      minHeight: touchH,
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,0.12)",
      background: "white",
      color: "#0f172a",
      fontWeight: 950,
      cursor: "pointer",
      textDecoration: "none",
      boxSizing: "border-box",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      WebkitTapHighlightColor: "transparent",
    };

    const btnPrimary: React.CSSProperties = {
      ...btnBase,
      border: "1px solid #0f172a",
      background: "#0f172a",
      color: "white",
      boxShadow: "0 10px 22px rgba(15,23,42,0.18)",
    };

    const btnDangerSoft: React.CSSProperties = {
      ...btnBase,
      background: "#fff7ed",
      borderColor: "#fed7aa",
      color: "#9a3412",
    };

    const btnSuccessSoft: React.CSSProperties = {
      ...btnBase,
      background: "#f0fdf4",
      borderColor: "#bbf7d0",
      color: "#166534",
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
      boxSizing: "border-box",
    };

    const missionCard: React.CSSProperties = {
      padding: isMobile ? 14 : 14,
      border: "1px solid rgba(15,23,42,0.10)",
      borderRadius: 16,
      background: "rgba(255,255,255,0.96)",
      boxShadow: "0 8px 22px rgba(15,23,42,0.05)",
      boxSizing: "border-box",
      display: "grid",
      gap: 10,
    };

    const foldWrap: React.CSSProperties = {
      border: "1px solid rgba(15,23,42,0.10)",
      borderRadius: 16,
      overflow: "hidden",
      background: "white",
      boxSizing: "border-box",
    };

    const foldBtn: React.CSSProperties = {
      width: "100%",
      textAlign: "left",
      padding: isMobile ? 14 : 14,
      border: "none",
      background: "linear-gradient(#ffffff, #ffffff)",
      cursor: "pointer",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: 12,
      boxSizing: "border-box",
    };

    return {
      touchH,
      page,
      hero,
      titleH1,
      sub,
      pill,
      dot,
      donePill,
      activePill,
      inactivePill,
      card,
      cardHeadBtn,
      cardBody,
      label,
      input,
      textarea,
      hint,
      btnBase,
      btnPrimary,
      btnDangerSoft,
      btnSuccessSoft,
      errorBox,
      missionCard,
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

    // ✅ owner-only controls disabled state
    const manageLocked = !connected || !connectedWallet || !isOwner;

    return (
      <div key={m.id} style={styles.missionCard}>
        <div style={{ fontSize: 15, fontWeight: 950, color: "#0f172a", lineHeight: 1.25 }}>
          {m.title}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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
            done ? <span style={styles.donePill}>✓ Completed</span> : <span style={styles.pill}>Not completed</span>
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

        <div style={{ ...styles.sub, marginTop: 0 }}>
          id: <span style={{ fontFamily: "monospace" }}>{m.id}</span>
        </div>

        {m.description && (
          <div style={{ fontSize: 14, color: "#0f172a", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
            {m.description}
          </div>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          <button
            onClick={() => {
              if (manageLocked) {
                setErr(!connected ? "Connect wallet in /dashboard to manage missions." : "Owner only: only project owner can manage missions.");
                return;
              }
              toggleActive(m.id, !m.active);
            }}
            disabled={manageLocked}
            style={{
              ...(m.active ? styles.btnDangerSoft : styles.btnSuccessSoft),
              width: "100%",
              opacity: manageLocked ? 0.55 : 1,
              cursor: manageLocked ? "not-allowed" : "pointer",
            }}
          >
            {m.active ? "Disable" : "Enable"}
          </button>
        </div>
      </div>
    );
  };

  // ✅ owner-only lock for create section
  const createLocked = !connected || !connectedWallet || !isOwner;

  return (
    <main style={styles.page}>
      {/* Header */}
      <div style={styles.hero}>
        <h1 style={styles.titleH1}>Project Missions</h1>
        <div style={styles.sub}>projectId: {projectId}</div>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={styles.pill}>{loading ? "Loading…" : `${missions.length} total`}</span>
          <span style={styles.pill}>{activeMissions.length} active</span>
          <span style={styles.pill}>{inactiveMissions.length} inactive</span>

          {/* ✅ role pill（不改结构，只加一个 pill） */}
          <span style={styles.pill}>
            role:{" "}
            <b style={{ marginLeft: 6 }}>
              {projectOwner ? (isOwner ? "OWNER" : "VIEWER") : "UNKNOWN"}
            </b>
          </span>

          {projectOwner ? (
            <span style={styles.pill}>
              owner: <span style={{ fontFamily: "monospace" }}>{fmtShort(projectOwner, 6)}</span>
            </span>
          ) : null}

          {connected && connectedWallet ? (
            <span style={styles.pill}>
              wallet: <span style={{ fontFamily: "monospace" }}>{fmtShort(connectedWallet, 6)}</span>
            </span>
          ) : null}

          {wallet ? <span style={styles.pill}>local: {fmtShort(wallet, 6)}</span> : null}
        </div>

        {/* ✅ 轻提示：非 owner 仍可看，但不可管理 */}
        {!isOwner && projectOwner && (
          <div style={{ marginTop: 10, ...styles.sub }}>
            This page is viewable by any wallet. <b>Mission management is owner-only.</b>
          </div>
        )}

        <div style={{ marginTop: 12, display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
          <a href={`/projects/${projectId}`} style={{ ...styles.btnBase, width: "100%" }}>
            Project
          </a>
          <button onClick={load} style={{ ...styles.btnBase, width: "100%" }}>
            Refresh
          </button>

          {/* ✅ Admin Reviews：保留结构，但非 owner 直接拦截 */}
          <a
            href={`/p/${projectId}/admin/reviews`}
            onClick={(e) => {
              if (!connected || !connectedWallet) {
                e.preventDefault();
                setErr("Connect wallet in /dashboard to open admin pages.");
                return;
              }
              if (!isOwner) {
                e.preventDefault();
                setErr("Owner only: admin reviews are restricted to the project owner wallet.");
                return;
              }
            }}
            style={{
              ...styles.btnPrimary,
              width: "100%",
              opacity: !connected || !connectedWallet || !isOwner ? 0.6 : 1,
            }}
          >
            Admin Reviews
          </a>

          <a href="/dashboard" style={{ ...styles.btnBase, width: "100%" }}>
            Dashboard
          </a>

          <a href="/missions" style={{ ...styles.btnBase, width: "100%", gridColumn: "1 / -1" }}>
            Mission Explore
          </a>
        </div>
      </div>

      {/* Create Mission (collapsible) */}
      <section style={styles.card}>
        <button onClick={() => setOpenCreate((v) => !v)} style={styles.cardHeadBtn}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 950, margin: 0, color: "#0f172a" }}>Create Mission</div>
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75, color: "#475569", lineHeight: 1.6 }}>
              {openCreate ? "Fill in details and publish a new mission." : "Tap to expand the create form."}
            </div>
          </div>
          <span style={styles.pill}>{openCreate ? "Collapse" : "Expand"}</span>
        </button>

        {openCreate && (
          <div style={styles.cardBody}>
            {/* ✅ owner lock hint（不改结构，只加一个小提示） */}
            {createLocked && (
              <div style={{ marginBottom: 12, ...styles.errorBox, borderColor: "#fde68a", background: "#fffbeb", color: "#92400e" }}>
                {(!connected || !connectedWallet)
                  ? "Connect wallet in /dashboard to create missions."
                  : "Owner only: only the project owner wallet can create missions."}
              </div>
            )}

            <form onSubmit={onCreate} style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gap: 8 }}>
                <label style={styles.label}>Title</label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Follow X / Join Telegram / Retweet"
                  style={{ ...styles.input, opacity: createLocked ? 0.75 : 1 }}
                  disabled={createLocked}
                />
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <label style={styles.label}>Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Keep it short and verifiable."
                  rows={4}
                  style={{ ...styles.textarea, opacity: createLocked ? 0.75 : 1 }}
                  disabled={createLocked}
                />
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <label style={styles.label}>Weight</label>
                <input
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  type="number"
                  min={1}
                  max={100000}
                  style={{ ...styles.input, opacity: createLocked ? 0.75 : 1 }}
                  disabled={createLocked}
                />
                <div style={styles.hint}>MVP uses SIGN_MESSAGE proof only.</div>
              </div>

              <button
                type="submit"
                disabled={createLocked || title.trim().length < 2}
                style={{
                  ...styles.btnPrimary,
                  opacity: createLocked || title.trim().length < 2 ? 0.6 : 1,
                  width: "100%",
                  cursor: createLocked ? "not-allowed" : "pointer",
                }}
              >
                Create
              </button>

              {err && <div style={styles.errorBox}>{err}</div>}
            </form>
          </div>
        )}
      </section>

      {/* Folded lists */}
      <section style={{ marginTop: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontSize: 16, fontWeight: 950, margin: 0, color: "#0f172a" }}>Missions</h2>
        <div style={{ fontSize: 12, opacity: 0.75, color: "#475569" }}>Fold by status</div>
      </section>

      {/* Active fold */}
      <div style={{ marginTop: 12, ...styles.foldWrap }}>
        <button onClick={() => setOpenActive((v) => !v)} style={styles.foldBtn}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 950, color: "#0f172a" }}>Active Missions</div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75, color: "#475569" }}>
              {activeMissions.length} mission(s)
            </div>
          </div>
          <span style={styles.pill}>{openActive ? "Collapse" : "Expand"}</span>
        </button>

        {openActive && (
          <div style={{ padding: 14, borderTop: "1px solid rgba(15,23,42,0.08)" }}>
            {loading ? (
              <div style={{ opacity: 0.8 }}>Loading...</div>
            ) : activeMissions.length === 0 ? (
              <div style={{ opacity: 0.8 }}>No active missions.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>{activeMissions.map(renderMission)}</div>
            )}
          </div>
        )}
      </div>

      {/* Inactive fold */}
      <div style={{ marginTop: 12, ...styles.foldWrap }}>
        <button onClick={() => setOpenInactive((v) => !v)} style={styles.foldBtn}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 950, color: "#0f172a" }}>Inactive Missions</div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75, color: "#475569" }}>
              {inactiveMissions.length} mission(s)
            </div>
          </div>
          <span style={styles.pill}>{openInactive ? "Collapse" : "Expand"}</span>
        </button>

        {openInactive && (
          <div style={{ padding: 14, borderTop: "1px solid rgba(15,23,42,0.08)" }}>
            {loading ? (
              <div style={{ opacity: 0.8 }}>Loading...</div>
            ) : inactiveMissions.length === 0 ? (
              <div style={{ opacity: 0.8 }}>No inactive missions.</div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>{inactiveMissions.map(renderMission)}</div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
