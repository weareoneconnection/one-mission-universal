"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

/* =========================
   Types (兼容后端字段)
========================= */

type Attachment = { name: string; url: string };

type ProofEvent = {
  id: string;
  type: "SUBMITTED" | "APPROVED" | "REJECTED" | "REVOKED";
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

  createdAt: number;
  updatedAt?: number;

  currentStatus: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
  events: ProofEvent[];

  // 积分/贡献（后端存在，前端展示）
  points?: number;
  reputationDelta?: number;

  // 提交 proof 时带的额外信息（你的后端现在在 root 上）
  payload?: {
    links?: string[];
    note?: string;
    attachments?: Attachment[];
  };
};

type Summary = {
  totalProofs: number;
  pending: number;
  approved: number;
  rejected: number;
  revoked: number;
  totalPoints: number;
  totalReputation: number;
};

type Tab = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

/* =========================
   On-chain Types (长期基础设施)
========================= */

type OnchainAccountRef = {
  label: string;
  address: string;
};

type OnchainTx = {
  signature: string;
  at?: number;
  type?: string;
};

type OnchainProfile = {
  ok: boolean;

  cluster: "mainnet-beta" | "devnet" | "testnet" | "custom";
  rpc?: string;

  // Program(s)
  programs?: {
    identity?: string;
    points?: string;
    mission?: string;
  };

  // Identity core
  identity?: {
    initialized: boolean;
    identityPda?: string;

    // optional identity fields
    createdAt?: number;
    lastUpdatedAt?: number;
    lastUpdatedSlot?: number;

    level?: number;
    badges?: string[];
  };

  // Aggregates
  totals?: {
    points?: number;
    reputation?: number;
  };

  // Accounts & recent activity
  accounts?: OnchainAccountRef[];
  recentTx?: OnchainTx[];

  // Sync hints
  sync?: {
    status?: "SYNCED" | "SYNCING" | "OUT_OF_SYNC" | "UNKNOWN";
    chainPoints?: number;
    chainReputation?: number;
    offchainApprovedPoints?: number;
    offchainReputation?: number;
    diffPoints?: number;
    diffReputation?: number;
    note?: string;
  };

  error?: string;
};

/* =========================
   UI Helpers (不改逻辑)
========================= */

function shortWallet(w: string) {
  if (!w) return "";
  return w.slice(0, 6) + "..." + w.slice(-6);
}

function fmtTime(ts?: number) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

function statusPill(status: Proof["currentStatus"]) {
  const base: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid #e5e7eb",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    letterSpacing: 0.2,
    whiteSpace: "nowrap",
  };

  const dot: React.CSSProperties = { width: 8, height: 8, borderRadius: 999, display: "inline-block" };

  switch (status) {
    case "PENDING":
      return (
        <span style={{ ...base, borderColor: "#f59e0b", color: "#b45309", background: "#fffbeb" }}>
          <span style={{ ...dot, background: "#f59e0b" }} />
          PENDING
        </span>
      );
    case "APPROVED":
      return (
        <span style={{ ...base, borderColor: "#22c55e", color: "#16a34a", background: "#f0fdf4" }}>
          <span style={{ ...dot, background: "#22c55e" }} />
          APPROVED
        </span>
      );
    case "REJECTED":
      return (
        <span style={{ ...base, borderColor: "#ef4444", color: "#b91c1c", background: "#fff1f2" }}>
          <span style={{ ...dot, background: "#ef4444" }} />
          REJECTED
        </span>
      );
    case "REVOKED":
      return (
        <span style={{ ...base, borderColor: "#9ca3af", color: "#6b7280", background: "#f9fafb" }}>
          <span style={{ ...dot, background: "#9ca3af" }} />
          REVOKED
        </span>
      );
  }
}

/* --- On-chain pills (同风格) --- */

function onchainPill(kind: "OK" | "WARN" | "BAD" | "NEUTRAL", text: string) {
  const base: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    fontWeight: 900,
    fontSize: 12,
    border: "1px solid #e5e7eb",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    letterSpacing: 0.2,
    whiteSpace: "nowrap",
  };
  const dot: React.CSSProperties = { width: 8, height: 8, borderRadius: 999, display: "inline-block" };

  if (kind === "OK")
    return (
      <span style={{ ...base, borderColor: "#22c55e", color: "#16a34a", background: "#f0fdf4" }}>
        <span style={{ ...dot, background: "#22c55e" }} />
        {text}
      </span>
    );
  if (kind === "WARN")
    return (
      <span style={{ ...base, borderColor: "#f59e0b", color: "#b45309", background: "#fffbeb" }}>
        <span style={{ ...dot, background: "#f59e0b" }} />
        {text}
      </span>
    );
  if (kind === "BAD")
    return (
      <span style={{ ...base, borderColor: "#ef4444", color: "#b91c1c", background: "#fff1f2" }}>
        <span style={{ ...dot, background: "#ef4444" }} />
        {text}
      </span>
    );
  return (
    <span style={{ ...base, borderColor: "#e5e7eb", color: "#374151", background: "#f9fafb" }}>
      <span style={{ ...dot, background: "#9ca3af" }} />
      {text}
    </span>
  );
}

function StatCard(props: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: "neutral" | "green" | "red" | "amber" | "purple";
}) {
  const accent = props.accent || "neutral";

  const borderMap: Record<string, string> = {
    neutral: "#e5e7eb",
    green: "#bbf7d0",
    red: "#fecaca",
    amber: "#fde68a",
    purple: "#ddd6fe",
  };
  const bgMap: Record<string, string> = {
    neutral: "#ffffff",
    green: "#f0fdf4",
    red: "#fff1f2",
    amber: "#fffbeb",
    purple: "#f5f3ff",
  };

  return (
    <div
      style={{
        border: `1px solid ${borderMap[accent]}`,
        background: bgMap[accent],
        borderRadius: 18,
        padding: 14,
        boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>{props.label}</div>
      <div style={{ marginTop: 6, fontSize: 26, fontWeight: 950, lineHeight: 1.05 }}>{props.value}</div>
      {props.hint && <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>{props.hint}</div>}
    </div>
  );
}

function Chip(props: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  const active = !!props.active;
  return (
    <button
      onClick={props.onClick}
      style={{
        padding: "10px 12px",
        borderRadius: 999,
        border: "1px solid #e5e7eb",
        background: active ? "#111827" : "#ffffff",
        color: active ? "#ffffff" : "#111827",
        fontWeight: 950,
        cursor: "pointer",
        letterSpacing: 0.2,
      }}
    >
      {props.children}
    </button>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#f3f4f6" }} />;
}

function emptyBox(title: string, desc?: string) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 18, padding: 18, background: "white" }}>
      <div style={{ fontWeight: 950, fontSize: 18 }}>{title}</div>
      {desc && <div style={{ marginTop: 8, opacity: 0.75 }}>{desc}</div>}
    </div>
  );
}

/* --- Explorer URL helper (长期可验证基础设施) --- */
function explorerBase(cluster: string) {
  // Solana Explorer 支持 ?cluster=devnet/testnet，自定义走 mainnet-beta
  if (cluster === "devnet") return "https://explorer.solana.com";
  if (cluster === "testnet") return "https://explorer.solana.com";
  if (cluster === "mainnet-beta") return "https://explorer.solana.com";
  return "https://explorer.solana.com";
}

function explorerQuery(cluster: string) {
  if (cluster === "devnet") return "?cluster=devnet";
  if (cluster === "testnet") return "?cluster=testnet";
  return ""; // mainnet-beta 默认
}

function explorerAccountUrl(cluster: string, address: string) {
  return `${explorerBase(cluster)}/address/${address}${explorerQuery(cluster)}`;
}

function explorerTxUrl(cluster: string, sig: string) {
  return `${explorerBase(cluster)}/tx/${sig}${explorerQuery(cluster)}`;
}

/* =========================
   Page (长期最终版)
========================= */

export default function ProfilePage() {
  const { publicKey, connected } = useWallet();
  const wallet = useMemo(() => (publicKey ? publicKey.toBase58() : ""), [publicKey]);

  const [loading, setLoading] = useState(false);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("ALL");
  const [q, setQ] = useState("");

  // On-chain state
  const [onchainLoading, setOnchainLoading] = useState(false);
  const [onchain, setOnchain] = useState<OnchainProfile | null>(null);
  const [onchainErr, setOnchainErr] = useState<string | null>(null);
  const [chainStatus, setChainStatus] = useState<any>(null);

  async function load() {
    setErr(null);
    if (!wallet) {
      setProofs([]);
      setSummary(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/profile/proofs?wallet=${encodeURIComponent(wallet)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Failed to load proofs");

      setProofs(Array.isArray(data.proofs) ? (data.proofs as Proof[]) : []);
      setSummary(data?.summary || null);
    } catch (e: any) {
      setErr(String(e?.message || e));
      setProofs([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }
function normalizeOnchain(data: any): OnchainProfile {
  const ok = !!data?.ok;

  return {
    ok,
    cluster: data?.cluster || "mainnet-beta",
    rpc: data?.rpc || "",
    programs: data?.programs || { points: "", mission: "" },

    identity: {
      initialized: !!data?.identity?.initialized,
      identityPda: data?.identity?.identityPda || "",
      createdAt: Number(data?.identity?.createdAt || 0),
      lastUpdatedAt: Number(data?.identity?.lastUpdatedAt || 0),
      lastUpdatedSlot: Number(data?.identity?.lastUpdatedSlot || 0),
      level: Number(data?.identity?.level || 0),
      badges: Array.isArray(data?.identity?.badges)
        ? data.identity.badges
        : [],
    },

    totals: {
      points: Number(data?.totals?.points || 0),
      reputation: Number(data?.totals?.reputation || 0),
    },

    accounts: Array.isArray(data?.accounts) ? data.accounts : [],
    recentTx: Array.isArray(data?.recentTx) ? data.recentTx : [],

    sync: data?.sync || { status: "UNKNOWN" },

    error: ok ? "" : String(data?.error || "ONCHAIN_API_FAILED"),
  };
}

async function loadOnchain() {
  setOnchainErr(null);
  if (!wallet) {
    setOnchain(null);
    return;
  }
  setOnchainLoading(true);
  try {
    const res = await fetch(`/api/profile/onchain?wallet=${encodeURIComponent(wallet)}`, {
      cache: "no-store",
    });

    const raw = await res.json();              // ✅ 不要直接 cast
    const data = normalizeOnchain(raw);        // ✅ 先兜底结构
    if (!data.ok) throw new Error(data.error || "Failed to load on-chain profile");

    setOnchain(data);                          // ✅ 这里已经是安全结构
  } catch (e: any) {
    setOnchainErr(String(e?.message || e));
    setOnchain(null);
  } finally {
    setOnchainLoading(false);
  }
}


  useEffect(() => {
    load();
    loadOnchain();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  /* =========================
     Stats（逻辑不变，只更健壮）
  ========================= */

  const stats = useMemo(() => {
  const all = proofs.length;
  const pending = proofs.filter((p) => p.currentStatus === "PENDING").length;
  const approved = proofs.filter((p) => p.currentStatus === "APPROVED").length;
  const rejected = proofs.filter((p) => p.currentStatus === "REJECTED").length;
  const revoked = proofs.filter((p) => p.currentStatus === "REVOKED").length;

  // 前端兜底：只按 Approved proof 的 points 累加
  const fallbackTotalPoints = proofs.reduce((sum, p) => {
    if (p.currentStatus !== "APPROVED") return sum;
    const n = Number(p.points);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const fallbackTotalReputation = proofs.reduce((sum, p) => {
    if (p.currentStatus === "PENDING") return sum;
    const n = Number(p.reputationDelta);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);

  const s = summary || null;

  // summary 可信度校验：
  // 1) summary.totalPoints 必须是有限数
  // 2) 如果 approved>0，但 summary.totalPoints === 0，而 fallback>0，则 summary 很可能错
  // 3) 如果 summary.totalPoints < fallbackTotalPoints（明显少算），也认为不可信
  const summaryPoints = Number(s?.totalPoints);
  const summaryPointsOk =
    Number.isFinite(summaryPoints) &&
    !(
      (approved > 0 && summaryPoints === 0 && fallbackTotalPoints > 0) ||
      (summaryPoints < fallbackTotalPoints)
    );

  const summaryRep = Number(s?.totalReputation);
  const summaryRepOk = Number.isFinite(summaryRep);

  return {
    all: Number.isFinite(Number(s?.totalProofs)) ? Number(s!.totalProofs) : all,
    pending: Number.isFinite(Number(s?.pending)) ? Number(s!.pending) : pending,
    approved: Number.isFinite(Number(s?.approved)) ? Number(s!.approved) : approved,
    rejected: Number.isFinite(Number(s?.rejected)) ? Number(s!.rejected) : rejected,
    revoked: Number.isFinite(Number(s?.revoked)) ? Number(s!.revoked) : revoked,

    // ✅ 关键：summary 不可信就用前端兜底
    totalPoints: summaryPointsOk ? summaryPoints : fallbackTotalPoints,
    totalReputation: summaryRepOk ? summaryRep : fallbackTotalReputation,

    // 给 sync 用（off-chain）
    offchainApprovedPoints: summaryPointsOk ? summaryPoints : fallbackTotalPoints,
    offchainReputation: summaryRepOk ? summaryRep : fallbackTotalReputation,
  };
}, [proofs, summary]);


  /* =========================
     Filter / Group（逻辑不变）
  ========================= */

  const filtered = useMemo(() => {
    const text = q.trim().toLowerCase();
    return proofs
      .filter((p) => {
        if (tab !== "ALL" && p.currentStatus !== tab) return false;
        if (!text) return true;
        return (
          String(p.projectId || "").toLowerCase().includes(text) ||
          String(p.missionId || "").toLowerCase().includes(text) ||
          String(p.id || "").toLowerCase().includes(text)
        );
      })
      .sort((a, b) => Number(b.updatedAt ?? b.createdAt ?? 0) - Number(a.updatedAt ?? a.createdAt ?? 0));
  }, [proofs, tab, q]);

  const grouped = useMemo(() => {
    const map = new Map<string, Proof[]>();
    for (const p of filtered) {
      const key = p.projectId || "unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries());
  }, [filtered]);

  /* =========================
     On-chain derived (长期展示)
  ========================= */

  const chainCluster = onchain?.cluster || "mainnet-beta";
  const identity = onchain?.identity || { initialized: false };
  const chainPoints = Number(onchain?.totals?.points ?? onchain?.sync?.chainPoints ?? 0);
  const chainRep = Number(onchain?.totals?.reputation ?? onchain?.sync?.chainReputation ?? 0);

  const derivedSync = useMemo(() => {
    const offPoints = Number(stats.offchainApprovedPoints ?? 0);
    const offRep = Number(stats.offchainReputation ?? 0);

    const diffPoints = chainPoints - offPoints;
    const diffRep = chainRep - offRep;

    // 规则：差值为 0 或很小视为 synced
    const pointsOk = Math.abs(diffPoints) <= 0;
    const repOk = Math.abs(diffRep) <= 0;

    let status: "SYNCED" | "OUT_OF_SYNC" | "UNKNOWN" = "UNKNOWN";
    if (!wallet) status = "UNKNOWN";
    else if (!onchain) status = "UNKNOWN";
    else if (pointsOk && repOk) status = "SYNCED";
    else status = "OUT_OF_SYNC";

    return {
      offPoints,
      offRep,
      diffPoints,
      diffRep,
      status,
    };
  }, [wallet, onchain, chainPoints, chainRep, stats.offchainApprovedPoints, stats.offchainReputation]);

  const identityPill = useMemo(() => {
    if (!connected || !wallet) return onchainPill("NEUTRAL", "WALLET DISCONNECTED");
    if (onchainLoading) return onchainPill("NEUTRAL", "LOADING");
    if (onchainErr) return onchainPill("BAD", "ON-CHAIN ERROR");
    if (!onchain) return onchainPill("NEUTRAL", "UNKNOWN");
    if (!identity?.initialized) return onchainPill("WARN", "NOT INITIALIZED");
    return onchainPill("OK", "INITIALIZED");
  }, [connected, wallet, onchainLoading, onchainErr, onchain, identity?.initialized]);

  const syncPill = useMemo(() => {
    if (!connected || !wallet) return onchainPill("NEUTRAL", "SYNC UNKNOWN");
    if (onchainLoading) return onchainPill("NEUTRAL", "SYNC CHECKING");
    if (onchainErr) return onchainPill("BAD", "SYNC ERROR");
    if (derivedSync.status === "SYNCED") return onchainPill("OK", "SYNCED");
    if (derivedSync.status === "OUT_OF_SYNC") return onchainPill("WARN", "OUT OF SYNC");
    return onchainPill("NEUTRAL", "UNKNOWN");
  }, [connected, wallet, onchainLoading, onchainErr, derivedSync.status]);

  const levelValue = useMemo(() => {
    const lv = Number(identity?.level ?? 0);
    if (lv > 0) return lv;
    // fallback：用 points 映射一个长期开箱即用的 Level（你可以后端替换为链上真实 level）
    // 规则：每 100 points 1 级，最低 1
    const p = Math.max(0, chainPoints);
    return p === 0 ? 0 : Math.max(1, Math.floor(p / 100) + 1);
  }, [identity?.level, chainPoints]);

  /* =========================
     Render
  ========================= */

  return (
    <main style={{ padding: 24, maxWidth: 1160, margin: "0 auto" }}>
      {/* Header */}
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-end" }}>
        <div>
          <h1 style={{ fontSize: 36, fontWeight: 950, margin: 0, letterSpacing: -0.5 }}>My Proofs</h1>
          <div style={{ marginTop: 10, opacity: 0.8, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 900, fontSize: 13 }}>Wallet</span>
            {wallet ? (
              <code
                style={{
                  padding: "4px 8px",
                  borderRadius: 10,
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                  fontWeight: 800,
                }}
              >
                {shortWallet(wallet)}
              </code>
            ) : (
              <span style={{ color: "#b91c1c", fontWeight: 900 }}>not connected</span>
            )}
            {connected && wallet && (
              <span style={{ fontSize: 12, opacity: 0.7 }}>· proofs are scoped to this wallet</span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <a
            href="/missions"
            style={{
              padding: "10px 14px",
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              textDecoration: "none",
              fontWeight: 950,
              color: "#111",
              background: "white",
              boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
            }}
          >
            Browse Missions
          </a>
          <button
            onClick={() => {
              load();
              loadOnchain();
            }}
            style={{
              padding: "10px 14px",
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              background: "white",
              fontWeight: 950,
              cursor: "pointer",
              boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
            }}
          >
            Refresh
          </button>
        </div>
      </header>

      {/* Error (off-chain) */}
      {err && (
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 14,
            border: "1px solid #fecaca",
            background: "#fff1f2",
            color: "#b91c1c",
            fontWeight: 900,
          }}
        >
          {err}
        </div>
      )}

      {/* Stats */}
      <section style={{ marginTop: 18 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          <StatCard label="All proofs" value={stats.all} />
          <StatCard label="Pending" value={stats.pending} hint="Waiting for review" accent="amber" />
          <StatCard label="Approved" value={stats.approved} hint="Earn points" accent="green" />
          <StatCard label="Rejected" value={stats.rejected} hint="Needs resubmission" accent="red" />
          <StatCard label="Total Points" value={stats.totalPoints} hint="Approved proofs only" accent="purple" />
          <StatCard label="Reputation" value={stats.totalReputation} hint="Contribution score" accent="neutral" />
        </div>
      </section>

      {/* =========================
          On-chain Overview (长期 Identity 基础设施)
         ========================= */}
      <section style={{ marginTop: 14 }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 18, background: "white" }}>
          <div style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 950, fontSize: 16 }}>On-chain Identity</div>
                <div style={{ marginTop: 4, opacity: 0.7, fontSize: 13 }}>
                  Long-term, verifiable infrastructure for your contribution identity.
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {identityPill}
                {syncPill}
                <button
                  onClick={loadOnchain}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 14,
                    border: "1px solid #e5e7eb",
                    background: "white",
                    fontWeight: 950,
                    cursor: "pointer",
                    boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
                  }}
                >
                  Refresh On-chain
                </button>
              </div>
            </div>
          </div>

          <Divider />

          {/* On-chain error */}
          {onchainErr && (
            <div
              style={{
                margin: 14,
                padding: 12,
                borderRadius: 14,
                border: "1px solid #fecaca",
                background: "#fff1f2",
                color: "#b91c1c",
                fontWeight: 900,
              }}
            >
              {onchainErr}
            </div>
          )}

          <div style={{ padding: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              <StatCard
                label="Identity"
                value={onchainLoading ? "…" : identity?.initialized ? "Initialized" : "Not initialized"}
                hint={
                  identity?.identityPda
                    ? `PDA ${shortWallet(identity.identityPda)}`
                    : connected && wallet
                      ? "Create your on-chain identity once"
                      : "Connect wallet to view"
                }
                accent={identity?.initialized ? "green" : "amber"}
              />

              <StatCard
                label="On-chain Points"
                value={onchainLoading ? "…" : chainPoints}
                hint="Verifiable aggregate"
                accent="purple"
              />

              <StatCard
                label="Chain Receipts"
                value={onchainLoading ? "…" : String(chainStatus?.finalizedCount ?? 0)}
                hint="Finalized proofs on Solana"
                accent="neutral"
              />

              <StatCard
                label="Level"
                value={onchainLoading ? "…" : levelValue}
                hint={identity?.badges?.length ? `${identity.badges.length} badge(s)` : "Built from on-chain signals"}
                accent="green"
              />

              <StatCard
                label="Sync"
                value={onchainLoading ? "…" : derivedSync.status === "SYNCED" ? "Synced" : derivedSync.status === "OUT_OF_SYNC" ? "Out of sync" : "Unknown"}
                hint={
                  onchainLoading
                    ? "Comparing off-chain vs chain…"
                    : `Δ points ${derivedSync.diffPoints >= 0 ? "+" : ""}${derivedSync.diffPoints}`
                }
                accent={derivedSync.status === "SYNCED" ? "green" : derivedSync.status === "OUT_OF_SYNC" ? "amber" : "neutral"}
              />

              <StatCard
                label="Network"
                value={onchainLoading ? "…" : (onchain?.cluster || "mainnet-beta")}
                hint={
                 onchain?.programs?.points
                  ? `Program ${shortWallet(onchain.programs.points)}`
                  : "Program not set"
               }
                accent="neutral"
              />
            </div>

            {/* Identity quick links */}
            {identity?.identityPda && (
              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <a
                  href={explorerAccountUrl(chainCluster, identity.identityPda)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    padding: "10px 14px",
                    borderRadius: 14,
                    border: "1px solid #111827",
                    background: "#111827",
                    color: "white",
                    textDecoration: "none",
                    fontWeight: 950,
                  }}
                >
                  View Identity on Explorer
                </a>

                {onchain?.programs?.identity && (
                  <a
                    href={explorerAccountUrl(chainCluster, onchain.programs.identity)}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: "10px 14px",
                      borderRadius: 14,
                      border: "1px solid #e5e7eb",
                      background: "white",
                      color: "#111827",
                      textDecoration: "none",
                      fontWeight: 950,
                    }}
                  >
                    View Program
                  </a>
                )}

                <span style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>
                  Last update {fmtTime(identity?.lastUpdatedAt || identity?.createdAt)}
                </span>
              </div>
            )}

            {/* On-chain details */}
            <details style={{ marginTop: 14 }}>
              <summary style={{ cursor: "pointer", fontWeight: 950, userSelect: "none" }}>View on-chain details</summary>

              <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
                {/* Accounts */}
                <div style={{ border: "1px solid #f3f4f6", borderRadius: 16, padding: 14, background: "#ffffff" }}>
                  <div style={{ fontWeight: 950, fontSize: 14 }}>Accounts</div>
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
                    These are the canonical on-chain references for your identity infrastructure.
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {(onchain?.accounts || []).length === 0 ? (
                      <div style={{ fontSize: 13, opacity: 0.7 }}>No accounts available.</div>
                    ) : (
                      onchain!.accounts!.map((a, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "center",
                            padding: "10px 12px",
                            border: "1px solid #e5e7eb",
                            borderRadius: 14,
                            background: "#f9fafb",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 950, fontSize: 13 }}>{a.label}</div>
                            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                              <code>{shortWallet(a.address)}</code>
                            </div>
                          </div>
                          <a
                            href={explorerAccountUrl(chainCluster, a.address)}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontWeight: 950, textDecoration: "underline", fontSize: 13 }}
                          >
                            View
                          </a>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent TX */}
                <div style={{ border: "1px solid #f3f4f6", borderRadius: 16, padding: 14, background: "#ffffff" }}>
                  <div style={{ fontWeight: 950, fontSize: 14 }}>Recent activity</div>
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
                    Last on-chain transactions related to your identity and score updates.
                  </div>

                  <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                    {(onchain?.recentTx || []).length === 0 ? (
                      <div style={{ fontSize: 13, opacity: 0.7 }}>No recent transactions.</div>
                    ) : (
                      onchain!.recentTx!.slice(0, 6).map((t, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "center",
                            padding: "10px 12px",
                            border: "1px solid #e5e7eb",
                            borderRadius: 14,
                            background: "#ffffff",
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 950, fontSize: 13 }}>
                              {t.type || "TRANSACTION"}{" "}
                              <span style={{ opacity: 0.7, fontWeight: 900 }}>· {t.at ? fmtTime(t.at) : "—"}</span>
                            </div>
                            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                              <code>{shortWallet(t.signature)}</code>
                            </div>
                          </div>
                          <a
                            href={explorerTxUrl(chainCluster, t.signature)}
                            target="_blank"
                            rel="noreferrer"
                            style={{ fontWeight: 950, textDecoration: "underline", fontSize: 13 }}
                          >
                            View
                          </a>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Sync explanation */}
                <div style={{ border: "1px solid #f3f4f6", borderRadius: 16, padding: 14, background: "#ffffff" }}>
                  <div style={{ fontWeight: 950, fontSize: 14 }}>Sync notes</div>
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85, lineHeight: 1.55 }}>
                    <div>
                      <b>Off-chain</b> shows your submitted proofs and review results. <b>On-chain</b> stores the long-term,
                      verifiable identity aggregates (points / reputation).
                    </div>
                    <div style={{ marginTop: 8 }}>
                      Current diff: <b>Δ points</b>{" "}
                      {derivedSync.diffPoints >= 0 ? "+" : ""}
                      {derivedSync.diffPoints}, <b>Δ rep</b>{" "}
                      {derivedSync.diffRep >= 0 ? "+" : ""}
                      {derivedSync.diffRep}.
                    </div>
                    {onchain?.sync?.note && <div style={{ marginTop: 8, opacity: 0.85 }}>{onchain.sync.note}</div>}
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>
      </section>

      {/* Controls */}
      <section style={{ marginTop: 14, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["ALL", "PENDING", "APPROVED", "REJECTED"] as Tab[]).map((t) => (
            <Chip key={t} active={tab === t} onClick={() => setTab(t)}>
              {t}
            </Chip>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 260 }}>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by project / mission / proof id…"
            style={{
              width: "100%",
              padding: "11px 12px",
              borderRadius: 14,
              border: "1px solid #e5e7eb",
              outline: "none",
              background: "white",
              fontWeight: 700,
            }}
          />
        </div>
      </section>

      {/* Content */}
      <section style={{ marginTop: 16 }}>
        {!connected || !wallet ? (
          emptyBox("Connect your wallet to view your proofs", "Your profile is wallet-based. Proofs are scoped to your wallet.")
        ) : loading ? (
          <div style={{ fontWeight: 950, padding: 8 }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 18, padding: 18, background: "white" }}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>No proofs found</div>
            <div style={{ marginTop: 8, opacity: 0.75 }}>
              You haven’t submitted any proofs yet (or your filter/search matches nothing).
            </div>
            <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
              <a
                href="/missions"
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: "1px solid #111827",
                  background: "#111827",
                  color: "white",
                  textDecoration: "none",
                  fontWeight: 950,
                }}
              >
                Go to Missions
              </a>
              <a
                href="/projects"
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: "1px solid #e5e7eb",
                  background: "white",
                  color: "#111827",
                  textDecoration: "none",
                  fontWeight: 950,
                }}
              >
                Explore Projects
              </a>
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {grouped.map(([proj, items]) => (
              <div key={proj} style={{ border: "1px solid #e5e7eb", borderRadius: 18, background: "white" }}>
                <div style={{ padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 950, fontSize: 16 }}>
                        Project <code>{proj}</code>
                      </div>
                      <div style={{ marginTop: 4, opacity: 0.7, fontSize: 13 }}>{items.length} proof(s)</div>
                    </div>

                    {/* Project mini summary（不改逻辑，只做展示） */}
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
                        Approved: {items.filter((p) => p.currentStatus === "APPROVED").length}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
                        Points:{" "}
                        {items.reduce((s, p) => s + (p.currentStatus === "APPROVED" ? Number(p.points ?? 0) : 0), 0)}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 900, opacity: 0.75 }}>
                        Rep:{" "}
                        {items.reduce((s, p) => s + (p.currentStatus !== "PENDING" ? Number(p.reputationDelta ?? 0) : 0), 0)}
                      </span>
                    </div>
                  </div>
                </div>

                <Divider />

                <div style={{ padding: 14, display: "grid", gap: 12 }}>
                  {items.map((p) => {
                    const last = p.events?.[p.events.length - 1];
                    const updated = Number(p.updatedAt ?? last?.at ?? p.createdAt ?? 0);

                    // 兼容：你现在提交时 payload 在 proof.root 上，不一定写入 SUBMITTED event.payload
                    const fromEventSubmitted = p.events?.find((e) => e.type === "SUBMITTED")?.payload;
                    const payload = p.payload || fromEventSubmitted || {};
                    const links = Array.isArray(payload.links) ? payload.links : [];
                    const note = String(payload.note || "").trim();

                    const pts = Number(p.points ?? 0);
                    const rep = Number(p.reputationDelta ?? 0);

                    return (
                      <div
                        key={p.id}
                        style={{
                          border: "1px solid #f3f4f6",
                          borderRadius: 16,
                          padding: 14,
                          background: "#ffffff",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 950, fontSize: 15 }}>
                              Mission <code>{p.missionId}</code>
                            </div>

                            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75, display: "flex", gap: 8, flexWrap: "wrap" }}>
                              <span>
                                Proof <code>{p.id}</code>
                              </span>
                              <span>· Updated {fmtTime(updated)}</span>
                            </div>

                            {(note || links.length > 0) && (
                              <div style={{ marginTop: 10 }}>
                                {note && (
                                  <div style={{ fontSize: 13, lineHeight: 1.45, marginBottom: links.length ? 8 : 0 }}>
                                    <span style={{ fontWeight: 950 }}>Note:</span>{" "}
                                    <span style={{ opacity: 0.9 }}>{note}</span>
                                  </div>
                                )}

                                {links.length > 0 && (
                                  <div style={{ fontSize: 13 }}>
                                    <span style={{ fontWeight: 950 }}>Links:</span>{" "}
                                    {links.slice(0, 3).map((u, i) => (
                                      <a
                                        key={i}
                                        href={u}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{ marginLeft: 8, textDecoration: "underline", fontWeight: 900 }}
                                      >
                                        link{i + 1}
                                      </a>
                                    ))}
                                    {links.length > 3 && (
                                      <span style={{ marginLeft: 10, opacity: 0.7, fontWeight: 900 }}>
                                        +{links.length - 3} more
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            {statusPill(p.currentStatus)}

                            {/* 右侧奖励展示（不改逻辑：Approved 才显示） */}
                            {p.currentStatus === "APPROVED" && (
                              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 950, color: "#111827" }}>
                                <span style={{ marginRight: 10 }}>+{pts} pts</span>
                                <span>
                                  {rep >= 0 ? "+" : ""}
                                  {rep} rep
                                </span>
                              </div>
                            )}

                            {p.currentStatus === "REJECTED" && (
                              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 950, color: "#b91c1c" }}>
                                {rep >= 0 ? "+" : ""}
                                {rep} rep
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Timeline（结构不变，视觉升级，兼容 events 为空） */}
                        <details style={{ marginTop: 12 }}>
                          <summary style={{ cursor: "pointer", fontWeight: 950, userSelect: "none" }}>
                            View timeline
                          </summary>

                          <div style={{ marginTop: 12 }}>
                            {!p.events || p.events.length === 0 ? (
                              <div style={{ fontSize: 13, opacity: 0.7 }}>No timeline events recorded yet.</div>
                            ) : (
                              <div style={{ borderLeft: "2px solid #e5e7eb", paddingLeft: 12 }}>
                                {p.events.map((e) => (
                                  <div key={e.id} style={{ marginBottom: 14 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                                      <div style={{ fontWeight: 950 }}>{e.type}</div>
                                      <div style={{ fontSize: 12, opacity: 0.7 }}>{fmtTime(e.at)}</div>
                                    </div>
                                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
                                      by <code>{shortWallet(e.by)}</code>
                                    </div>
                                    {e.reason && (
                                      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
                                        <b>Reason:</b> {e.reason}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </details>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
