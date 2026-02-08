"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

/* =========================
   Types
========================= */

type Project = {
  id: string;
  name: string;
  slug: string;
  website?: string;
  chain: "solana";
  ownerWallet: string;
  createdAt: number;
  updatedAt: number;
};

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
  wallet: string;

  proofType: "SIGN_MESSAGE";
  message: string;
  signature: string;

  issuedAt: number;
  createdAt: number;

  currentStatus?: "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";
  updatedAt?: number;

  chainStatus?: "OFFCHAIN" | "QUEUED" | "SUBMITTED" | "FINALIZED" | "FAILED";
  chainTx?: string;
};

type ChainStatus = {
  mode: "OFFCHAIN" | "PREPARING" | "ONCHAIN";
  network: "solana";
  lastSyncAt?: number;
  pendingQueue?: number;
  onchainRecords?: number;
  lastError?: string;
};

/* =========================
   Utils
========================= */

function safeNumber(x: any, fallback = 0) {
  const n = Number(x);
  return Number.isFinite(n) ? n : fallback;
}

function fmtShortAddress(s: string, n = 4) {
  if (!s) return "";
  if (s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

function fmtTime(ts: number) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    fontSize: 12,
    fontWeight: 950,
    background: active ? "#111827" : "white",
    color: active ? "white" : "#111827",
    whiteSpace: "nowrap",
  };
}

function statusPillStyle(status?: Proof["currentStatus"]): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    fontSize: 12,
    fontWeight: 950,
    background: "white",
    whiteSpace: "nowrap",
  };
  if (!status) return { ...base, opacity: 0.8 };

  if (status === "APPROVED") return { ...base, borderColor: "#bbf7d0", color: "#166534", background: "#f0fdf4" };
  if (status === "REJECTED") return { ...base, borderColor: "#fecaca", color: "#991b1b", background: "#fef2f2" };
  if (status === "PENDING") return { ...base, borderColor: "#fde68a", color: "#92400e", background: "#fffbeb" };
  if (status === "REVOKED") return { ...base, borderColor: "#e5e7eb", color: "#111827", background: "#f9fafb" };

  return base;
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    padding: "10px 12px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: active ? "#111827" : "#ffffff",
    color: active ? "#ffffff" : "#111827",
    fontWeight: 950,
    cursor: "pointer",
    letterSpacing: 0.2,
  };
}

/* =========================
   Page
========================= */

type Tab = "OVERVIEW" | "ACTIVITY";

export default function HomePage() {
  const { publicKey, connected } = useWallet();
  const wallet = useMemo(() => (publicKey ? publicKey.toBase58() : ""), [publicKey]);

  const [tab, setTab] = useState<Tab>("OVERVIEW");

  const [projects, setProjects] = useState<Project[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(0);

  const [proofSource, setProofSource] = useState<"global" | "wallet" | "none">("none");

  // ✅ 你说 on-chain 已运行：默认以 ONCHAIN 展示（后续接 /api/chain/status 再动态）
  const [chainStatus, setChainStatus] = useState<ChainStatus>({
    mode: "ONCHAIN",
    network: "solana",
    lastSyncAt: undefined,
    pendingQueue: 0,
    onchainRecords: 0,
    lastError: undefined,
  });

  const [activityQuery, setActivityQuery] = useState("");

  async function fetchAnyProofs(): Promise<{ list: any[]; source: "global" | "wallet" | "none" }> {
    // 1) try global endpoint
    try {
      const prJson = await fetch("/api/proofs?limit=20", { cache: "no-store" }).then((r) => r.json());
      const list = Array.isArray(prJson) ? prJson : prJson?.proofs || prJson?.items || prJson?.data || [];
      if (Array.isArray(list) && list.length > 0) return { list, source: "global" };
    } catch {}

    // 2) fallback to wallet-scoped profile endpoint
    if (wallet) {
      try {
        const pr2 = await fetch(`/api/profile/proofs?wallet=${encodeURIComponent(wallet)}`, { cache: "no-store" }).then(
          (r) => r.json()
        );
        const list2 = Array.isArray(pr2?.proofs) ? pr2.proofs : [];
        if (list2.length > 0) return { list: list2, source: "wallet" };
      } catch {}
    }

    return { list: [], source: "none" };
  }

  async function loadChainStatus() {
    try {
      const j = await fetch("/api/chain/status", { cache: "no-store" }).then((r) => r.json());

      // 兼容你当前后端返回结构：
      // { ok, queue:{length}, lastSyncAt, finalizedCount, lastError }
      if (j?.ok) {
        setChainStatus((prev) => ({
          ...prev,
          mode: "ONCHAIN",
          network: "solana",
          lastSyncAt: typeof j.lastSyncAt === "number" ? j.lastSyncAt : prev.lastSyncAt,
          pendingQueue:
            typeof j?.queue?.length === "number" ? j.queue.length : safeNumber(j.pendingQueue, prev.pendingQueue ?? 0),
          onchainRecords:
            typeof j.finalizedCount === "number" ? j.finalizedCount : safeNumber(j.onchainRecords, prev.onchainRecords ?? 0),
          lastError: j.lastError ? String(j.lastError) : undefined,
        }));
      }
    } catch {
      // 不要把页面弄报错：保持现状即可
    }
  }

  async function loadAll() {
    setLoading(true);
    setErr(null);

    try {
      const [pRes, mRes] = await Promise.all([
        fetch("/api/projects", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/missions", { cache: "no-store" }).then((r) => r.json()),
      ]);

      if (!pRes?.ok) throw new Error(pRes?.error || "Failed to load projects");
      if (!mRes?.ok) throw new Error(mRes?.error || "Failed to load missions");

      setProjects(pRes.projects || []);
      setMissions(mRes.missions || []);

      const { list: rawList, source } = await fetchAnyProofs();
      setProofSource(source);

      const normalized: Proof[] = (rawList || []).map((x: any) => {
        const created = safeNumber(x.createdAt ?? x.updatedAt ?? x.issuedAt ?? x.time ?? 0, 0);
        const updated = safeNumber(x.updatedAt ?? 0, 0);

        return {
          id: String(x.id ?? x.proofId ?? x.proof_id ?? ""),
          missionId: String(x.missionId ?? x.misId ?? x.mission_id ?? ""),
          projectId: String(x.projectId ?? x.projId ?? x.project_id ?? ""),
          wallet: String(x.wallet ?? x.userWallet ?? x.user_wallet ?? x.address ?? ""),

          proofType: "SIGN_MESSAGE",
          message: String(x.message ?? x.msg ?? ""),
          signature: String(x.signature ?? x.sig ?? ""),

          issuedAt: safeNumber(x.issuedAt ?? created ?? 0, 0),
          createdAt: created,

          currentStatus: (x.currentStatus ?? x.status ?? x.state) || undefined,
          updatedAt: updated || undefined,

          chainStatus: (x.chainStatus ?? x.onchainStatus) || undefined,
          chainTx: (x.chainTx ?? x.tx ?? x.signatureTx) || undefined,
        };
      });

      const cleaned = normalized.filter((p) => p.id && p.projectId && p.missionId && p.wallet);
      setProofs(cleaned);
      setLastUpdated(Date.now());

      // ✅ on-chain 运行：优先用 proof 的链上状态推断（没有也保持 ONCHAIN 展示）
      setChainStatus((prev) => {
        const pendingQueue = cleaned.filter((p) => p.chainStatus === "QUEUED").length;
        const onchainRecords = cleaned.filter((p) => p.chainStatus === "FINALIZED").length;
        const hasAnyChain = cleaned.some((p) => !!p.chainStatus);

        return {
          ...prev,
          mode: hasAnyChain ? "ONCHAIN" : prev.mode,
          pendingQueue,
          onchainRecords,
        };
      });
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") loadAll();
    }

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", loadAll);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", loadAll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet]);

  useEffect(() => {
    loadChainStatus();
    const t = setInterval(loadChainStatus, 8000); // 8秒刷新一次
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =========================
     Derived data
  ========================= */

  const maps = useMemo(() => {
    const projName = new Map<string, string>();
    for (const p of projects) projName.set(p.id, p.name);

    const missionTitle = new Map<string, string>();
    for (const m of missions) missionTitle.set(m.id, m.title);

    return { projName, missionTitle };
  }, [projects, missions]);

  const stats = useMemo(() => {
    const activeMissions = missions.filter((m) => m.active).length;
    const totalWeight = missions.reduce((sum, m) => sum + (m.weight || 0), 0);

    const WINDOW = 7 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - WINDOW;

    const recentProofs = proofs.filter((p) => (p.createdAt || 0) >= cutoff);
    const uniqueWalletsRecent = new Set(recentProofs.map((p) => p.wallet).filter(Boolean)).size;

    const byStatus = {
      pending: proofs.filter((p) => p.currentStatus === "PENDING").length,
      approved: proofs.filter((p) => p.currentStatus === "APPROVED").length,
      rejected: proofs.filter((p) => p.currentStatus === "REJECTED").length,
      revoked: proofs.filter((p) => p.currentStatus === "REVOKED").length,
    };
    const hasStatus = Object.values(byStatus).some((n) => n > 0);

    return {
      projects: projects.length,
      missions: missions.length,
      activeMissions,
      totalWeight,
      recentProofs: recentProofs.length,
      uniqueWalletsRecent,
      byStatus,
      hasStatus,
    };
  }, [projects, missions, proofs]);

  const recentProjects = useMemo(() => projects.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 3), [projects]);
  const recentMissions = useMemo(() => missions.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, 4), [missions]);
  const recentProofs = useMemo(
    () => proofs.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 8),
    [proofs]
  );

  const activityList = useMemo(() => {
    const q = activityQuery.trim().toLowerCase();
    const list = proofs.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 20);
    if (!q) return list;
    return list.filter((p) => {
      const pn = (maps.projName.get(p.projectId) || "").toLowerCase();
      const mt = (maps.missionTitle.get(p.missionId) || "").toLowerCase();
      return (
        p.id.toLowerCase().includes(q) ||
        p.projectId.toLowerCase().includes(q) ||
        p.missionId.toLowerCase().includes(q) ||
        p.wallet.toLowerCase().includes(q) ||
        pn.includes(q) ||
        mt.includes(q)
      );
    });
  }, [proofs, activityQuery, maps]);

  /* =========================
     Render
  ========================= */

  const phaseLabel =
    chainStatus.mode === "ONCHAIN" ? "On-chain · Live" : chainStatus.mode === "PREPARING" ? "On-chain · Preparing" : "MVP · Off-chain";

  return (
    <main style={{ padding: "clamp(16px, 4vw, 28px)", paddingBottom: "clamp(56px, 10vw, 80px)", maxWidth: 1160, margin: "0 auto" }}>
      {/* Hero */}
      <section style={{ marginTop: 6 }}>
        <div style={heroWrap}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            <div style={{ minWidth: 280, flex: "1 1 620px" }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <span style={pillStyle(true)}>{phaseLabel}</span>

                <span style={{ fontSize: 12, opacity: 0.75 }}>
                  {lastUpdated ? <>Last updated: {fmtTime(lastUpdated)}</> : <>—</>}
                </span>

                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  · proofs source: <b>{proofSource}</b>
                </span>
              </div>

              <h1 style={{ marginTop: 12, fontSize: "clamp(28px, 5vw, 44px)", fontWeight: 950, lineHeight: 1.05 }}>
                One Mission Universal
                <br />
                Contribution → Identity → On-chain
              </h1>

              <p style={{ marginTop: 12, fontSize: "clamp(14px, 2.2vw, 16px)", opacity: 0.85, maxWidth: 860, lineHeight: 1.6 }}>
                A universal Proof-of-Contribution console for projects and users. Review remains human; the chain is the
                permanent record.
              </p>

              {/* ✅ Hero shortcuts（加 One AI 入口） */}
              <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <a href="/projects" style={btnPrimary}>
                  Create / Manage Projects
                </a>
                <a href="/missions" style={btnGhost}>
                  Explore Missions
                </a>
                <a href="/ai" style={btnGhost}>
                  Open One AI
                </a>
                <a href="/profile" style={btnGhost}>
                  Open Profile
                </a>
                <button onClick={loadAll} style={btnGhostButton}>
                  {loading ? "Refreshing…" : "Refresh"}
                </button>
              </div>

              {err && <div style={{ marginTop: 12, color: "#b91c1c", fontWeight: 950 }}>{err}</div>}

              {/* Tabs */}
              <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => setTab("OVERVIEW")} style={chipStyle(tab === "OVERVIEW")}>
                  Overview
                </button>
                <button onClick={() => setTab("ACTIVITY")} style={chipStyle(tab === "ACTIVITY")}>
                  Activity
                </button>
              </div>
            </div>

            {/* Right column */}
            <div style={{ flex: "1 1 380px", minWidth: 280, maxWidth: 520 }}>
              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 950 }}>System Status</div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>recent = 7d</div>
                </div>

                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  <StatRow label="Projects" value={loading ? "…" : String(stats.projects)} />
                  <StatRow label="Missions" value={loading ? "…" : String(stats.missions)} />
                  <StatRow label="Active missions" value={loading ? "…" : String(stats.activeMissions)} />
                  <StatRow label="Total mission weight" value={loading ? "…" : String(stats.totalWeight)} />
                  <StatRow label="Recent proofs" value={loading ? "…" : String(stats.recentProofs)} />
                  <StatRow label="Unique wallets (recent)" value={loading ? "…" : String(stats.uniqueWalletsRecent)} />
                </div>

                {stats.hasStatus && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #e5e7eb" }}>
                    <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.8 }}>Proof status</div>
                    <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                      <StatRow label="Approved" value={String(stats.byStatus.approved)} />
                      <StatRow label="Rejected" value={String(stats.byStatus.rejected)} />
                      <StatRow label="Pending" value={String(stats.byStatus.pending)} />
                      <StatRow label="Revoked" value={String(stats.byStatus.revoked)} />
                    </div>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 12, ...card }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 950 }}>Chain Status</div>
                  <div style={{ fontSize: 12, opacity: 0.65 }}>{chainStatus.network.toUpperCase()}</div>
                </div>

                <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                  <StatRow
                    label="Mode"
                    value={
                      chainStatus.mode === "ONCHAIN" ? "On-chain (live)" : chainStatus.mode === "PREPARING" ? "Preparing" : "Off-chain"
                    }
                  />
                  <StatRow label="Last sync" value={chainStatus.lastSyncAt ? fmtTime(chainStatus.lastSyncAt) : "—"} />
                  <StatRow label="Pending queue" value={String(chainStatus.pendingQueue ?? 0)} />
                  <StatRow label="On-chain records" value={String(chainStatus.onchainRecords ?? 0)} />
                </div>

                {chainStatus.lastError && (
                  <div
                    style={{
                      marginTop: 12,
                      padding: 10,
                      borderRadius: 12,
                      border: "1px solid #fecaca",
                      background: "#fef2f2",
                      color: "#991b1b",
                      fontWeight: 900,
                      overflowWrap: "anywhere",
                    }}
                  >
                    {chainStatus.lastError}
                  </div>
                )}

                <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7, lineHeight: 1.5 }}>
                  This card can be powered by <code>/api/chain/status</code> (queue, sync, receipts).
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      {tab === "OVERVIEW" ? (
        <>
          {/* System map */}
          <section style={{ marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 950 }}>System map</div>
              <div style={{ fontSize: 13, opacity: 0.75 }}>Operational console · On-chain record as the source of truth</div>
            </div>

            <div style={{ marginTop: 10 }}>
              <SystemMap mode={chainStatus.mode} />
            </div>
          </section>

          {/* Next actions */}
          <section style={{ marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 950 }}>Next actions</div>
              <div style={{ fontSize: 13, opacity: 0.75 }}>Shortcuts · keep homepage fast & small</div>
            </div>

            {/* ✅ 修正：这里不能自闭合，必须包 ActionCard */}
            <div
              style={{
                marginTop: 10,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: 12,
              }}
            >
              {/* ✅ One AI 入口卡（放最前） */}
              <ActionCard
                title="One AI · Contribution Draft"
                desc="Turn real actions into structured drafts. No points. No submission required."
                primary={{ text: "Open One AI", href: "/ai" }}
                secondary={{ text: "Why this exists", href: "/ai" }}
                badge="quiet layer"
              />

              <ActionCard
                title="Project Registry"
                desc="Create projects and set owner wallet. Projects publish missions."
                primary={{ text: "Open Projects", href: "/projects" }}
                secondary={{ text: "Create Mission", href: "/projects" }}
              />

              <ActionCard
                title="Mission Execution"
                desc="Users complete missions and submit verifiable proofs."
                primary={{ text: "Explore Missions", href: "/missions" }}
                secondary={{ text: "Open Profile", href: "/profile" }}
              />

              <ActionCard
                title="Review → On-chain"
                desc="Approve proofs, then write verified contribution to Solana."
                primary={{ text: "Go to Dashboard", href: "/dashboard" }}
                secondary={{ text: "View Activity", onClick: () => setTab("ACTIVITY") }}
                badge="on-chain live"
              />
            </div>
          </section>

          {/* Recent activity */}
          <section style={{ marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 950 }}>Recent activity</div>
              <div style={{ fontSize: 13, opacity: 0.75 }}>Fixed length · no infinite lists</div>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 12 }}>
                <Panel title="Projects" subtitle="Latest (3)" rightLink={{ text: "View all →", href: "/projects" }}>
                  {recentProjects.length === 0 ? (
                    <Empty text="No projects yet. Create your first project." href="/projects" />
                  ) : (
                    recentProjects.map((p) => (
                      <ItemRow
                        key={p.id}
                        title={p.name}
                        meta={`id: ${p.id} · owner: ${fmtShortAddress(p.ownerWallet)}`}
                        href={`/projects/${p.id}`}
                        right={p.chain}
                      />
                    ))
                  )}
                </Panel>

                <Panel title="Missions" subtitle="Latest (4)" rightLink={{ text: "View all →", href: "/missions" }}>
                  {recentMissions.length === 0 ? (
                    <Empty text="No missions yet. Create one under a project." href="/projects" />
                  ) : (
                    recentMissions.map((m) => (
                      <ItemRow
                        key={m.id}
                        title={m.title}
                        meta={`id: ${m.id} · project: ${m.projectId} · weight: ${m.weight} · ${m.active ? "active" : "inactive"}`}
                        href={`/missions/${m.id}`}
                        right={m.proofType}
                      />
                    ))
                  )}
                </Panel>
              </div>

              <Panel title="Proofs" subtitle="Latest (8)" rightLink={{ text: "View Activity →", onClick: () => setTab("ACTIVITY") }}>
                {recentProofs.length === 0 ? (
                  <div style={dashedBox}>No proofs on homepage list. If you have proofs on Profile, connect wallet and refresh.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {recentProofs.map((p) => {
                      const pn = maps.projName.get(p.projectId) || p.projectId;
                      const mt = maps.missionTitle.get(p.missionId) || p.missionId;

                      return (
                        <div key={p.id} style={proofRow}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 950, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                              <span style={{ fontFamily: "monospace" }}>{fmtShortAddress(p.wallet, 6)}</span>
                              {p.currentStatus && <span style={statusPillStyle(p.currentStatus)}>{p.currentStatus}</span>}
                            </div>

                            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8, lineHeight: 1.5 }}>
                              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                project: <b>{pn}</b>
                              </div>
                              <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                mission:{" "}
                                <a href={`/missions/${p.missionId}`} style={{ textDecoration: "underline", fontWeight: 950 }}>
                                  {mt}
                                </a>
                              </div>
                            </div>
                          </div>

                          <div style={{ fontSize: 12, opacity: 0.75, textAlign: "right", flexShrink: 0 }}>
                            {fmtTime(p.createdAt)}
                            <div style={{ marginTop: 8 }}>
                              <span style={pillStyle(true)}>{p.chainStatus ? "ON-CHAIN" : "VERIFIED"}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>
            </div>
          </section>

          {/* ✅ 更高级黑框 CTA + 底部版权 */}
          <section style={{ marginTop: 18 }}>
            <FinalCta mode={chainStatus.mode} />
          </section>

          <footer style={footer}>
            Console home · Fixed length · APIs: /api/projects · /api/missions · /api/proofs · /api/profile/proofs · (optional) /api/chain/status
          </footer>

          <div style={copyright}>
            © {new Date().getFullYear()} WAOC · We Are One Connection · weareoneconnection.org
          </div>
        </>
      ) : (
        <>
          {/* Activity tab */}
          <section style={{ marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 950 }}>Activity</div>
              <div style={{ fontSize: 13, opacity: 0.75 }}>Latest proofs (max 20) · Searchable</div>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={activityQuery}
                onChange={(e) => setActivityQuery(e.target.value)}
                placeholder="Search wallet / project / mission / proof id…"
                style={searchInput}
              />
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                {connected && wallet ? (
                  <>
                    Wallet: <code style={codePill}>{fmtShortAddress(wallet, 6)}</code>
                  </>
                ) : (
                  <>Tip: connect wallet to enable profile fallback if global proofs is empty</>
                )}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              {activityList.length === 0 ? (
                <div style={dashedBox}>No activity found.</div>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {activityList.map((p) => {
                    const pn = maps.projName.get(p.projectId) || p.projectId;
                    const mt = maps.missionTitle.get(p.missionId) || p.missionId;

                    return (
                      <div key={p.id} style={proofRow}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 950, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ fontFamily: "monospace" }}>{fmtShortAddress(p.wallet, 6)}</span>
                            {p.currentStatus && <span style={statusPillStyle(p.currentStatus)}>{p.currentStatus}</span>}
                          </div>

                          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8, lineHeight: 1.5 }}>
                            <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              project: <b>{pn}</b>
                            </div>
                            <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              mission:{" "}
                              <a href={`/missions/${p.missionId}`} style={{ textDecoration: "underline", fontWeight: 950 }}>
                                {mt}
                              </a>
                            </div>
                            <div style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>
                              proofId: <span style={{ fontFamily: "monospace" }}>{p.id}</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ fontSize: 12, opacity: 0.75, textAlign: "right", flexShrink: 0 }}>
                          {fmtTime(p.createdAt)}
                          <div style={{ marginTop: 8 }}>
                            <a href="/profile" style={{ ...miniLink, marginRight: 10 }}>
                              Profile
                            </a>
                            <a href={`/missions/${p.missionId}`} style={miniLink}>
                              Mission
                            </a>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <section style={{ marginTop: 18 }}>
              <FinalCta mode={chainStatus.mode} />
            </section>

            <footer style={footer}>Activity is capped at 20 for speed.</footer>

            <div style={copyright}>
              © {new Date().getFullYear()} WAOC · We Are One Connection · weareoneconnection.org
            </div>
          </section>
        </>
      )}
    </main>
  );
}

/* =========================
   Components
========================= */

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
      <div style={{ opacity: 0.75, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div
        style={{
          fontWeight: 950,
          flexShrink: 0,
          maxWidth: "60%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "right",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  rightLink,
  children,
}: {
  title: string;
  subtitle?: string;
  rightLink?: { text: string; href?: string; onClick?: () => void };
  children: React.ReactNode;
}) {
  return (
    <div style={panelCard}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 950 }}>{title}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          {subtitle && <div style={{ fontSize: 12, opacity: 0.7 }}>{subtitle}</div>}
          {rightLink && rightLink.href && (
            <a href={rightLink.href} style={rightLinkStyle}>
              {rightLink.text}
            </a>
          )}
          {rightLink && rightLink.onClick && (
            <button onClick={rightLink.onClick} style={rightLinkBtn}>
              {rightLink.text}
            </button>
          )}
        </div>
      </div>
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  );
}

function ItemRow({ title, meta, href, right }: { title: string; meta: string; href: string; right?: string }) {
  return (
    <div style={itemRow}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 950 }}>
          <a href={href} style={{ textDecoration: "underline", color: "#111827" }}>
            {title}
          </a>
        </div>
        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75, overflowWrap: "anywhere" }}>{meta}</div>
      </div>
      {right && <div style={rightTag}>{right}</div>}
    </div>
  );
}

function Empty({ text, href }: { text: string; href: string }) {
  return (
    <div style={dashedBox}>
      {text}{" "}
      <a href={href} style={{ textDecoration: "underline", fontWeight: 900 }}>
        Open
      </a>
    </div>
  );
}

function ActionCard(props: {
  title: string;
  desc: string;
  primary: { text: string; href?: string; onClick?: () => void };
  secondary?: { text: string; href?: string; onClick?: () => void };
  badge?: string;
}) {
  return (
    <div style={actionCard}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 15, fontWeight: 950 }}>{props.title}</div>
        {props.badge && <span style={badgePill}>{props.badge}</span>}
      </div>
      <div style={{ marginTop: 8, opacity: 0.85, lineHeight: 1.6 }}>{props.desc}</div>

      <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
        {props.primary.href ? (
          <a href={props.primary.href} style={btnMiniPrimary}>
            {props.primary.text}
          </a>
        ) : (
          <button onClick={props.primary.onClick} style={btnMiniPrimaryBtn}>
            {props.primary.text}
          </button>
        )}

        {props.secondary &&
          (props.secondary.href ? (
            <a href={props.secondary.href} style={btnMiniGhost}>
              {props.secondary.text}
            </a>
          ) : (
            <button onClick={props.secondary.onClick} style={btnMiniGhostBtn}>
              {props.secondary.text}
            </button>
          ))}
      </div>
    </div>
  );
}

/* ---------- System Map ---------- */

function SystemMap({ mode }: { mode: "OFFCHAIN" | "PREPARING" | "ONCHAIN" }) {
  const stepBadge = (text: string) => (
    <span
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid #e5e7eb",
        background: "#f9fafb",
        fontWeight: 950,
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );

  const finalBadge = mode === "ONCHAIN" ? "On-chain: live" : mode === "PREPARING" ? "Preparing" : "On-chain: next";

  return (
    <div style={sysWrap}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12 }}>
        <div style={sysCol}>
          <div style={sysTitle}>Projects</div>
          <div style={sysDesc}>Create project → publish missions</div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {stepBadge("Project Registry")}
            {stepBadge("Mission Publishing")}
            {stepBadge("Weights")}
          </div>

          <div style={sysList}>
            <div>• Owner wallet becomes publisher</div>
            <div>• Missions define proof type + weight</div>
            <div>• Multi-project isolation stays clean</div>
          </div>
        </div>

        <div style={sysCol}>
          <div style={sysTitle}>Users</div>
          <div style={sysDesc}>Complete mission → submit proof</div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {stepBadge("Connect Wallet")}
            {stepBadge("Sign Message")}
            {stepBadge("Submit Proof")}
          </div>

          <div style={sysList}>
            <div>• Proof is verifiable (signature)</div>
            <div>• Profile aggregates into identity</div>
            <div>• One proof per mission per wallet (next)</div>
          </div>
        </div>

        <div style={sysCol}>
          <div style={sysTitle}>Verification → On-chain</div>
          <div style={sysDesc}>Approve / reject → write verified contribution to Solana</div>

          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {stepBadge("Review Queue")}
            {stepBadge("Status Timeline")}
            {stepBadge(finalBadge)}
          </div>

          <div style={sysList}>
            <div>• Admin review produces status events</div>
            <div>• Approved proofs become points / rep</div>
            <div>• On-chain receipts are the permanent record</div>
          </div>
        </div>
      </div>

      <div style={sysPipe}>
        <span style={{ fontWeight: 950, fontSize: 12, opacity: 0.75 }}>Pipeline:</span>
        <span style={pipePill}>Project</span>
        <span style={{ opacity: 0.6 }}>→</span>
        <span style={pipePill}>Mission</span>
        <span style={{ opacity: 0.6 }}>→</span>
        <span style={pipePill}>Proof</span>
        <span style={{ opacity: 0.6 }}>→</span>
        <span style={pipePill}>Review</span>
        <span style={{ opacity: 0.6 }}>→</span>
        <span style={pipePill}>{mode === "ONCHAIN" ? "On-chain (live)" : "On-chain (next)"}</span>
      </div>
    </div>
  );
}

/* ---------- Final CTA ---------- */

function FinalCta({ mode }: { mode: "OFFCHAIN" | "PREPARING" | "ONCHAIN" }) {
  const subtitle =
    mode === "ONCHAIN"
      ? "On-chain is live. Keep reviews strict, and scale mission volume safely."
      : mode === "PREPARING"
      ? "Preparing on-chain sync. Next step: start writing receipts."
      : "Running fast off-chain. Next step: approvals + chain receipts.";

  return (
    <div style={ctaWrap}>
      <div style={{ maxWidth: 620 }}>
        <div style={{ fontSize: 16, fontWeight: 950 }}>Ready for the next step?</div>
        <div style={{ marginTop: 6, opacity: 0.88, lineHeight: 1.6 }}>{subtitle}</div>

        <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <span style={ctaChip}>Human review stays the gate</span>
          <span style={ctaChip}>Chain keeps the record</span>
          <span style={ctaChip}>Noise stays out</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <a href="/ai" style={ctaGhost}>
          Open One AI
        </a>
        <a href="/dashboard" style={ctaGhost}>
          Review / Dashboard
        </a>
        <a href="/projects" style={ctaPrimary}>
          Create Project
        </a>
      </div>
    </div>
  );
}

/* =========================
   Styles
========================= */

const heroWrap: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: "clamp(14px, 3.5vw, 20px)",
  background:
    "radial-gradient(1200px 420px at 20% 0%, rgba(17,24,39,0.10), transparent), radial-gradient(800px 300px at 90% 20%, rgba(17,24,39,0.06), transparent)",
};

const card: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: "clamp(14px, 3vw, 16px)",
  background: "white",
};

const panelCard: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: "clamp(14px, 3vw, 16px)",
  background: "white",
};

const itemRow: React.CSSProperties = {
  padding: 12,
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
  flexWrap: "wrap",
  background: "white",
};

const rightTag: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 950,
  opacity: 0.9,
  padding: "6px 10px",
  border: "1px solid #e5e7eb",
  borderRadius: 999,
  flexShrink: 0,
  alignSelf: "flex-start",
};

const dashedBox: React.CSSProperties = {
  padding: 12,
  border: "1px dashed #e5e7eb",
  borderRadius: 14,
  opacity: 0.85,
  lineHeight: 1.6,
  background: "white",
};

const proofRow: React.CSSProperties = {
  padding: 12,
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  flexWrap: "wrap",
  alignItems: "flex-start",
  background: "white",
};

const actionCard: React.CSSProperties = {
  padding: "clamp(14px, 3vw, 16px)",
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  background: "white",
};

const badgePill: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 950,
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  opacity: 0.9,
};

const btnPrimary: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #111827",
  background: "#111827",
  color: "white",
  fontWeight: 950,
  textDecoration: "none",
};

const btnGhost: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  fontWeight: 950,
  textDecoration: "none",
  background: "white",
  color: "#111827",
};

const btnGhostButton: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  fontWeight: 950,
  background: "white",
  cursor: "pointer",
  color: "#111827",
};

const btnMiniPrimary: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #111827",
  background: "#111827",
  color: "white",
  textDecoration: "none",
  fontWeight: 950,
};

const btnMiniPrimaryBtn: React.CSSProperties = {
  ...btnMiniPrimary,
  cursor: "pointer",
};

const btnMiniGhost: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "white",
  color: "#111827",
  textDecoration: "none",
  fontWeight: 950,
};

const btnMiniGhostBtn: React.CSSProperties = {
  ...btnMiniGhost,
  cursor: "pointer",
};

const rightLinkStyle: React.CSSProperties = {
  textDecoration: "underline",
  fontWeight: 950,
  fontSize: 12,
  color: "#111827",
};

const rightLinkBtn: React.CSSProperties = {
  border: "none",
  background: "transparent",
  padding: 0,
  cursor: "pointer",
  textDecoration: "underline",
  fontWeight: 950,
  fontSize: 12,
  color: "#111827",
};

const searchInput: React.CSSProperties = {
  flex: 1,
  minWidth: 200,
  padding: "11px 12px",
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  outline: "none",
  background: "white",
  fontWeight: 700,
};

const codePill: React.CSSProperties = {
  padding: "4px 8px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  fontWeight: 800,
};

const miniLink: React.CSSProperties = {
  textDecoration: "underline",
  fontWeight: 950,
  color: "#111827",
  fontSize: 12,
};

const footer: React.CSSProperties = {
  marginTop: 18,
  opacity: 0.7,
  fontSize: 13,
  lineHeight: 1.7,
};

const copyright: React.CSSProperties = {
  marginTop: 10,
  opacity: 0.75,
  fontSize: 12,
  lineHeight: 1.6,
  color: "#6b7280",
  paddingBottom: 10,
};

/* System map styles */
const sysWrap: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: "clamp(14px, 3vw, 16px)",
  background: "white",
};

const sysCol: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 16,
  padding: 14,
  background: "white",
};

const sysTitle: React.CSSProperties = { fontSize: 14, fontWeight: 950 };
const sysDesc: React.CSSProperties = { marginTop: 6, fontSize: 13, opacity: 0.75, lineHeight: 1.5 };
const sysList: React.CSSProperties = { marginTop: 10, fontSize: 13, opacity: 0.85, lineHeight: 1.7 };

const sysPipe: React.CSSProperties = {
  marginTop: 14,
  paddingTop: 12,
  borderTop: "1px solid #f3f4f6",
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const pipePill: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  fontWeight: 950,
  fontSize: 12,
};

/* ✅ Upgraded Final CTA styles */
const ctaWrap: React.CSSProperties = {
  borderRadius: 20,
  padding: "clamp(14px, 3vw, 18px)",
  color: "white",
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  flexWrap: "wrap",
  alignItems: "center",
  border: "1px solid rgba(255,255,255,0.12)",
  background:
    "radial-gradient(900px 300px at 10% 20%, rgba(255,255,255,0.10), transparent), radial-gradient(700px 260px at 90% 10%, rgba(255,255,255,0.08), transparent), linear-gradient(135deg, #0b1220, #111827 55%, #0b1220)",
  boxShadow: "0 18px 50px rgba(17,24,39,0.25)",
};

const ctaChip: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 999,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  fontWeight: 900,
  fontSize: 12,
  opacity: 0.95,
};

const ctaPrimary: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.25)",
  background: "white",
  color: "#111827",
  fontWeight: 950,
  textDecoration: "none",
};

const ctaGhost: React.CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.22)",
  background: "transparent",
  color: "white",
  fontWeight: 950,
  textDecoration: "none",
};
