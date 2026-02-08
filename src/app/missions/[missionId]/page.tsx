// apps/web/src/app/missions/[missionId]/page.tsx
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

function fmtTime(ms?: number) {
  if (!ms) return "-";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

export default function MissionDetailPage() {
  const params = useParams<{ missionId: string }>();
  const missionId = String(params?.missionId || "");

  const [loading, setLoading] = useState(true);
  const [m, setM] = useState<Mission | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
  const [status, setStatus] = useState<"NONE" | "PENDING" | "APPROVED">("NONE");

  async function loadMission() {
    if (!missionId) return;
    setLoading(true);
    setErr(null);
    try {
      // MVP：用 /api/missions 拉全量再 find（与你现有项目一致）
      const res = await fetch(`/api/missions`, { cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || `Failed to load (${res.status})`);
      }

      const list: Mission[] = Array.isArray(data?.missions) ? data.missions : [];
      const found = list.find((x) => String(x.id) === String(missionId)) || null;
      setM(found);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function loadWalletStatus(targetMission?: Mission | null) {
    try {
      const w = String(localStorage.getItem("one_wallet") || "").trim();
      setWallet(w);
      if (!w || !targetMission?.id) return;

      const pr = await fetch(`/api/profile/proofs?wallet=${encodeURIComponent(w)}`, {
        cache: "no-store",
      }).then((r) => r.json());

      const list: Proof[] = Array.isArray(pr?.proofs) ? pr.proofs : [];
      const hit = list.find((p) => String(p.missionId) === String(targetMission.id));

      if (hit?.currentStatus === "APPROVED") setStatus("APPROVED");
      else if (hit?.currentStatus === "PENDING") setStatus("PENDING");
      else setStatus("NONE");
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadMission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId]);

  useEffect(() => {
    loadWalletStatus(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.id]);

  const styles = useMemo(() => {
    const page: React.CSSProperties = {
      padding: isMobile ? 14 : 24,
      maxWidth: 980,
      margin: "0 auto",
      boxSizing: "border-box",
      paddingBottom: 90,
    };

    const hero: React.CSSProperties = {
      borderRadius: isMobile ? 18 : 22,
      padding: isMobile ? 14 : 18,
      border: "1px solid rgba(15,23,42,0.10)",
      background:
        "radial-gradient(900px 320px at 20% 0%, rgba(15,23,42,0.10), transparent), radial-gradient(700px 260px at 90% 20%, rgba(15,23,42,0.06), transparent), linear-gradient(#ffffff, #ffffff)",
      boxShadow: "0 14px 45px rgba(15, 23, 42, 0.07)",
    };

    const title: React.CSSProperties = {
      fontSize: isMobile ? 22 : 28,
      fontWeight: 950,
      margin: 0,
      letterSpacing: -0.2,
      lineHeight: 1.1,
      color: "#0f172a",
      wordBreak: "break-word",
    };

    const sub: React.CSSProperties = {
      marginTop: 8,
      opacity: 0.78,
      fontSize: 13,
      lineHeight: 1.65,
      color: "#334155",
      wordBreak: "break-all",
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

    const card: React.CSSProperties = {
      marginTop: 14,
      padding: isMobile ? 14 : 16,
      border: "1px solid rgba(15,23,42,0.10)",
      borderRadius: 18,
      background: "white",
      boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
    };

    const btnBase: React.CSSProperties = {
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
      width: isMobile ? "100%" : "auto",
      boxSizing: "border-box",
    };

    const btnPrimary: React.CSSProperties = {
      ...btnBase,
      border: "1px solid #0f172a",
      background: "#0f172a",
      color: "white",
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

    return { page, hero, title, sub, pill, dot, statusPill, card, btnBase, btnPrimary, errorBox };
  }, [isMobile]);

  if (!missionId) {
    return (
      <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Missing missionId</h1>
        <a href="/missions" style={{ textDecoration: "underline", fontWeight: 900 }}>
          Back to Missions
        </a>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={styles.page}>
        <div style={styles.hero}>
          <h1 style={styles.title}>Loading…</h1>
        </div>
      </main>
    );
  }

  if (err) {
    return (
      <main style={styles.page}>
        <div style={styles.hero}>
          <h1 style={styles.title}>Error</h1>
          <div style={styles.errorBox}>{err}</div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/missions" style={styles.btnBase}>
              Back to Missions
            </a>
            <button onClick={loadMission} style={styles.btnBase}>
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!m) {
    return (
      <main style={styles.page}>
        <div style={styles.hero}>
          <h1 style={styles.title}>Mission not found</h1>
          <div style={styles.sub}>
            missionId: <code>{missionId}</code>
          </div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/missions" style={styles.btnBase}>
              Back to Missions
            </a>
          </div>
        </div>
      </main>
    );
  }

  const activePill = m.active
    ? styles.statusPill("#f0fdf4", "#bbf7d0", "#166534")
    : styles.statusPill("#fff7ed", "#fed7aa", "#9a3412");

  const walletPill =
    !wallet
      ? styles.pill
      : status === "APPROVED"
      ? styles.statusPill("#f0fdf4", "#bbf7d0", "#166534")
      : status === "PENDING"
      ? styles.statusPill("#fff7ed", "#fed7aa", "#9a3412")
      : styles.pill;

  const walletText =
    !wallet ? "wallet: not connected" : `wallet: ${fmtShort(wallet, 6)}`;

  const statusText =
    !wallet ? "Connect wallet in /dashboard to show status" : status === "APPROVED" ? "✓ Completed" : status === "PENDING" ? "Submitted (pending)" : "Not done";

  return (
    <main style={styles.page}>
      {/* Hero */}
      <div style={styles.hero}>
        <h1 style={styles.title}>{m.title}</h1>

        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <span style={styles.pill}>
            proof: <b>{m.proofType}</b>
          </span>
          <span style={styles.pill}>
            weight: <b>{m.weight}</b>
          </span>
          <span style={activePill}>
            <span style={styles.dot(m.active ? "#22c55e" : "#f97316")} />
            {m.active ? "active" : "inactive"}
          </span>

          <span style={walletPill}>{statusText}</span>
          <span style={styles.pill}>{walletText}</span>
        </div>

        <div style={styles.sub}>
          missionId: <code>{m.id}</code>
          {"  "}· projectId: <code>{m.projectId}</code>
        </div>

        {/* CTA */}
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr",
            gap: 10,
          }}
        >
          {/* ✅ 关键：指向 submit */}
          <a href={`/missions/${encodeURIComponent(m.id)}/submit`} style={styles.btnPrimary}>
            {status === "APPROVED" ? "View / Resubmit" : "Submit Proof"}
          </a>

          <a href="/missions" style={styles.btnBase}>
            Back to Missions
          </a>

          <a href={`/projects/${encodeURIComponent(m.projectId)}`} style={styles.btnBase}>
            Project
          </a>

          <a href="/dashboard" style={styles.btnBase}>
            Dashboard
          </a>
        </div>
      </div>

      {/* Description */}
      <section style={styles.card}>
        <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a" }}>Mission details</div>

        {m.description ? (
          <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.75, color: "#0f172a", whiteSpace: "pre-wrap" }}>
            {m.description}
          </div>
        ) : (
          <div style={{ marginTop: 10, fontSize: 13, opacity: 0.7, color: "#334155", lineHeight: 1.7 }}>
            No description provided.
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75, color: "#475569", lineHeight: 1.6 }}>
          Created: {fmtTime(m.createdAt)} · Updated: {fmtTime(m.updatedAt)}
        </div>
      </section>

      {/* Helper */}
      <section style={styles.card}>
        <div style={{ fontSize: 14, fontWeight: 950, color: "#0f172a" }}>How to complete</div>
        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8, color: "#334155", lineHeight: 1.7 }}>
          1) Click <b>Submit Proof</b> → fill evidence (links / note / attachments). <br />
          2) Sign message (MVP) and submit. <br />
          3) Wait for admin review. <br />
          <br />
          Status meaning: <b>Submitted</b> = pending review, <b>Completed</b> = approved.
        </div>
      </section>
    </main>
  );
}
