"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";

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

type MeRoleResp = {
  ok: boolean;
  connected?: boolean;
  wallet?: string;
  role?: "OWNER" | "USER";
  landing?: string;
};

function short(s: string, n = 8) {
  if (!s) return "-";
  if (s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

export default function MissionsExplorePage() {
  const router = useRouter();
  const { publicKey, connected } = useWallet();
  const wallet = useMemo(() => (publicKey ? publicKey.toBase58() : ""), [publicKey]);

  // ✅ role state
  const [roleLoading, setRoleLoading] = useState(false);
  const [role, setRole] = useState<"OWNER" | "USER">("USER");

  // ✅ lock condition（你原本逻辑不变）
  const locked = !connected || !wallet;

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 860);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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

  // =========================
  // ✅ Role resolve (ONLY when wallet connected)
  // =========================
  useEffect(() => {
    let cancelled = false;

    async function loadRole() {
      if (!connected || !wallet) {
        setRole("USER");
        return;
      }

      setRoleLoading(true);
      try {
        const j: MeRoleResp = await fetch("/api/me/role", { cache: "no-store" }).then((r) => r.json());
        if (cancelled) return;

        const r = j?.role === "OWNER" ? "OWNER" : "USER";
        setRole(r);

        // ✅ 如果是项目钱包，禁止停留在 missions
        if (r === "OWNER") {
          router.replace("/projects");
        }
      } catch {
        if (!cancelled) setRole("USER");
      } finally {
        if (!cancelled) setRoleLoading(false);
      }
    }

    loadRole();
    return () => {
      cancelled = true;
    };
  }, [connected, wallet, router]);

  // ✅ OWNER 访问 missions：直接返回一个轻提示（避免闪屏看到内容）
  const roleBlocked = connected && wallet && role === "OWNER";

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
    // ✅ locked: do not try proofs
    if (!wallet) {
      setProofs([]);
      return;
    }
    setProofsLoading(true);
    try {
      const res = await fetch(`/api/profile/proofs?wallet=${encodeURIComponent(wallet)}`, {
        cache: "no-store",
      });
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

      // 手机：默认只展开第 1 个；桌面：默认展开前 2 个
      const next: Record<string, boolean> = {};
      for (let i = 0; i < grouped.length; i++) next[grouped[i][0]] = i < (isMobile ? 1 : 2);
      return next;
    });
  }, [loading, grouped, isMobile]);

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
  // Styles (mobile-first)
  // =========================
  const touchH = 44;

  const pageWrap: React.CSSProperties = {
    padding: isMobile ? 14 : 24,
    maxWidth: 1060,
    margin: "0 auto",
    boxSizing: "border-box",
    // ✅ 手机底部留更多空间给 sticky bar（含 safe-area）
    paddingBottom: isMobile ? "calc(132px + env(safe-area-inset-bottom, 0px))" : 32,
  };

  const hero: React.CSSProperties = {
    border: "1px solid rgba(15,23,42,0.10)",
    borderRadius: isMobile ? 18 : 22,
    padding: isMobile ? 14 : 18,
    background:
      "radial-gradient(900px 280px at 20% 0%, rgba(17,24,39,0.08), transparent), radial-gradient(700px 240px at 90% 10%, rgba(17,24,39,0.05), transparent), #fff",
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
  };

  const pill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid rgba(15,23,42,0.12)",
    background: "#f8fafc",
    fontWeight: 950,
    fontSize: 12,
    whiteSpace: "nowrap",
    boxSizing: "border-box",
    maxWidth: "100%",
  };

  const btn: React.CSSProperties = {
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
    // ✅ 小屏避免按钮挤压导致文字换行怪异
    whiteSpace: "nowrap",
  };

  const btnPrimary: React.CSSProperties = {
    ...btn,
    borderColor: "#0f172a",
    background: "#0f172a",
    color: "white",
    boxShadow: "0 10px 22px rgba(15,23,42,0.18)",
  };

  const input: React.CSSProperties = {
    width: "100%",
    minHeight: touchH,
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(15,23,42,0.14)",
    outline: "none",
    background: "white",
    fontWeight: 750,
    boxSizing: "border-box",
  };

  const groupWrap: React.CSSProperties = {
    border: "1px solid rgba(15,23,42,0.10)",
    borderRadius: 18,
    background: "white",
    overflow: "hidden",
    boxShadow: "0 8px 22px rgba(15,23,42,0.05)",
  };

  const summaryRow: React.CSSProperties = {
    listStyle: "none",
    cursor: "pointer",
    padding: isMobile ? 12 : 14,
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    userSelect: "none",
    background:
      "radial-gradient(900px 220px at 20% 0%, rgba(15,23,42,0.05), transparent), linear-gradient(180deg, #fff, #fbfbfb)",
    // ✅ iOS 点击更稳
    WebkitTapHighlightColor: "transparent",
  };

  const missionCard: React.CSSProperties = {
    border: "1px solid rgba(15,23,42,0.10)",
    borderRadius: 16,
    background: "white",
    padding: isMobile ? 12 : 14,
    boxShadow: "0 8px 22px rgba(15,23,42,0.05)",
    display: "grid",
    gap: 10,
    // ✅ 防止长文本撑爆
    minWidth: 0,
  };

  const metaRow: React.CSSProperties = {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  };

  function statusPill(kind: "ACTIVE" | "INACTIVE") {
    if (kind === "ACTIVE") return { ...pill, background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" };
    return { ...pill, background: "#fff7ed", borderColor: "#fed7aa", color: "#9a3412" };
  }

  function ctaPill(kind: "START" | "PENDING" | "APPROVED" | "REJECTED" | "DISABLED", text: string) {
    const base: React.CSSProperties = {
      minHeight: touchH,
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,0.12)",
      fontSize: 13,
      fontWeight: 950,
      userSelect: "none",
      whiteSpace: "nowrap",
      textDecoration: "none",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      boxSizing: "border-box",
      width: isMobile ? "100%" : "auto",
    };

    if (kind === "START")
      return <span style={{ ...base, background: "#0f172a", color: "white", borderColor: "#0f172a" }}>{text}</span>;
    if (kind === "PENDING")
      return <span style={{ ...base, background: "#fffbeb", color: "#92400e", borderColor: "#fde68a" }}>{text}</span>;
    if (kind === "APPROVED")
      return <span style={{ ...base, background: "#f0fdf4", color: "#166534", borderColor: "#bbf7d0" }}>{text}</span>;
    if (kind === "REJECTED")
      return <span style={{ ...base, background: "#fff1f2", color: "#991b1b", borderColor: "#fecaca" }}>{text}</span>;
    return <span style={{ ...base, background: "#f8fafc", color: "#6b7280", borderColor: "#e5e7eb" }}>{text}</span>;
  }

  // ✅ OWNER 被重定向时，避免页面闪现内容
  if (roleBlocked) {
    return (
      <main style={pageWrap}>
        <section style={hero}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={pill}>Role: OWNER</span>
            <span style={pill}>Redirecting…</span>
          </div>
          <div style={{ marginTop: 10, opacity: 0.78, lineHeight: 1.6, color: "#334155", fontSize: 13 }}>
            This wallet is a <b>project owner</b>. Missions are for users. Redirecting to <b>/projects</b>.
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <a href="/projects" style={btnPrimary}>
              Go to Projects
            </a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      {/* HERO */}
      <section style={hero}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ minWidth: 0, flex: "1 1 520px" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={pill}>Mission Library</span>

              {connected && wallet ? (
                <span style={pill}>
                  wallet: <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{short(wallet, 10)}</span>
                  {proofsLoading && <span style={{ opacity: 0.7 }}>checking…</span>}
                </span>
              ) : (
                <span style={{ ...pill, background: "#fff1f2", borderColor: "#fecaca", color: "#991b1b" }}>
                  Wallet required to open missions
                </span>
              )}

              {/* ✅ role pill（不改结构，增加一颗） */}
              <span style={pill}>
                role: <b>{connected && wallet ? (roleLoading ? "…" : role) : "USER"}</b>
              </span>

              <span style={pill}>{loading ? "Loading…" : `${filtered.length} mission(s)`}</span>
            </div>

            <h1
              style={{
                marginTop: 10,
                fontSize: isMobile ? 28 : 36,
                fontWeight: 950,
                lineHeight: 1.08,
                letterSpacing: -0.4,
                color: "#0f172a",
              }}
            >
              Missions
            </h1>

            <div style={{ marginTop: 8, opacity: 0.78, lineHeight: 1.6, color: "#334155", fontSize: 13 }}>
              Browse missions across all projects. Search, fold by project, and see your completion status once wallet is connected.
            </div>

            {/* Controls */}
            <div
              style={{
                marginTop: 12,
                display: "grid",
                gap: 10,
                // ✅ 手机下更稳定：第一行两列按钮，搜索独占一行（结构不变，只是布局更“稳”）
                gridTemplateColumns: isMobile ? "1fr 1fr" : "auto auto auto auto auto 1fr",
                alignItems: "stretch",
              }}
            >
              <label
                style={{
                  ...btn,
                  justifyContent: "flex-start",
                  gap: 10,
                  padding: "10px 12px",
                  gridColumn: isMobile ? "1 / -1" : undefined,
                }}
              >
                <input
                  type="checkbox"
                  checked={activeOnly}
                  onChange={(e) => setActiveOnly(e.target.checked)}
                  style={{ width: 18, height: 18 }}
                />
                <span style={{ fontWeight: 950, fontSize: 13 }}>Active only</span>
              </label>

              <button onClick={() => openAll(true)} style={{ ...btn, width: "100%" }}>
                Expand
              </button>
              <button onClick={() => openAll(false)} style={{ ...btn, width: "100%" }}>
                Collapse
              </button>

              {/* ✅ USER 区不应该给 Projects/Dashboard（不乱结构：保留按钮位，但改成 Gate / Profile 更合理） */}
              <a href="/profile" style={{ ...btn, width: "100%" }}>
                Profile
              </a>
              <a href="/gate" style={{ ...btn, width: "100%" }}>
                Switch
              </a>

              {/* ✅ 顶部搜索：手机下保留但弱化（主要用底部 sticky 搜索更顺） */}
              <div style={{ gridColumn: isMobile ? "1 / -1" : "auto", width: "100%", opacity: isMobile ? 0.88 : 1 }}>
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title / description / project / id…" style={input} />
              </div>
            </div>

            {/* ✅ hard lock hint */}
            {locked && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid #fecaca",
                  background: "#fff1f2",
                  color: "#991b1b",
                  fontWeight: 900,
                  lineHeight: 1.6,
                }}
              >
                Wallet not connected. You can browse missions, but <b>cannot open</b> mission pages or submit proofs.
                <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a href="/dashboard" style={btnPrimary}>
                    Connect Wallet
                  </a>
                </div>
              </div>
            )}

            {err && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 14,
                  border: "1px solid #fecaca",
                  background: "#fff1f2",
                  color: "#991b1b",
                  fontWeight: 900,
                }}
              >
                {err}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* LIST */}
      <section style={{ marginTop: 14 }}>
        {loading ? (
          <div style={{ marginTop: 10, opacity: 0.8 }}>Loading missions…</div>
        ) : filtered.length === 0 ? (
          <div style={{ marginTop: 10, padding: 14, borderRadius: 14, border: "1px dashed rgba(15,23,42,0.18)", opacity: 0.85 }}>
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
                  style={groupWrap}
                >
                  <summary style={summaryRow}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 950, fontSize: 14, color: "#0f172a" }}>
                        Project{" "}
                        <span
                          style={{
                            fontFamily: "ui-monospace, Menlo, monospace",
                            opacity: 0.9,
                            display: "inline-block",
                            maxWidth: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            verticalAlign: "bottom",
                          }}
                        >
                          {short(pid, 10)}
                        </span>
                      </div>
                      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.75, color: "#475569" }}>
                        {list.length} mission(s) · {activeCount} active
                      </div>
                    </div>
                    <span style={pill}>{open ? "Collapse" : "Expand"}</span>
                  </summary>

                  <div style={{ padding: isMobile ? 12 : 14, paddingTop: 0, display: "grid", gap: 12 }}>
                    {list.map((m) => {
                      const st = missionStatus.get(m.id);

                      let kind: "START" | "PENDING" | "APPROVED" | "REJECTED" | "DISABLED" = "START";
                      let text = "Start";

                      if (!locked) {
                        if (st === "APPROVED") {
                          kind = "APPROVED";
                          text = "Completed";
                        } else if (st === "PENDING") {
                          kind = "PENDING";
                          text = "Submitted";
                        } else if (st === "REJECTED") {
                          kind = "REJECTED";
                          text = "Rejected";
                        } else if (st === "REVOKED") {
                          kind = "DISABLED";
                          text = "Revoked";
                        } else {
                          kind = "START";
                          text = "Start";
                        }
                      } else {
                        // ✅ hard lock: always show connect
                        kind = "DISABLED";
                        text = "Connect wallet";
                      }

                      const href = `/p/${encodeURIComponent(m.projectId)}/missions/${encodeURIComponent(m.id)}`;

                      return (
                        <div key={m.id} style={missionCard}>
                          {/* Title + status */}
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: 15,
                                  fontWeight: 950,
                                  lineHeight: 1.25,
                                  color: "#0f172a",
                                  wordBreak: "break-word",
                                }}
                              >
                                {m.title}
                              </div>
                              <div style={{ marginTop: 6, ...metaRow }}>
                                <span style={pill}>
                                  proof: <b>{m.proofType}</b>
                                </span>
                                <span style={pill}>
                                  weight: <b>{m.weight}</b>
                                </span>
                              </div>
                            </div>

                            <span style={m.active ? statusPill("ACTIVE") : statusPill("INACTIVE")}>{m.active ? "ACTIVE" : "INACTIVE"}</span>
                          </div>

                          {/* Description */}
                          {m.description && (
                            <div style={{ fontSize: 13, lineHeight: 1.65, color: "#0f172a", opacity: 0.9, wordBreak: "break-word" }}>
                              {m.description}
                            </div>
                          )}

                          {/* Small meta */}
                          <div style={{ fontSize: 12, color: "#475569", opacity: 0.9 }}>
                            project:{" "}
                            <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{short(m.projectId, 10)}</span> · id:{" "}
                            <span style={{ fontFamily: "ui-monospace, Menlo, monospace" }}>{short(m.id, 10)}</span>
                          </div>

                          {/* CTA area (locked = no href) */}
                          <div style={{ display: "grid", gap: 10 }}>
                            {locked ? (
                              <a href="/dashboard" style={{ textDecoration: "none" }}>
                                {ctaPill("START", "Connect wallet")}
                              </a>
                            ) : kind === "DISABLED" ? (
                              ctaPill(kind, text)
                            ) : (
                              <a href={href} style={{ textDecoration: "none" }}>
                                {ctaPill(kind, text)}
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

      {/* Mobile sticky bottom bar */}
      {isMobile && (
        <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, padding: "0 12px calc(12px + env(safe-area-inset-bottom, 0px))" }}>
          <div
            style={{
              maxWidth: 1060,
              margin: "0 auto",
              border: "1px solid rgba(15,23,42,0.10)",
              borderRadius: 18,
              background: "rgba(255,255,255,0.96)",
              backdropFilter: "blur(10px)",
              boxShadow: "0 18px 50px rgba(15,23,42,0.12)",
              padding: 10,
              display: "grid",
              gap: 10,
            }}
          >
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search missions…" style={input} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button onClick={() => openAll(true)} style={btn}>
                Expand
              </button>
              <button onClick={() => openAll(false)} style={btn}>
                Collapse
              </button>
            </div>

            {locked && (
              <a href="/dashboard" style={{ ...btnPrimary, width: "100%" }}>
                Connect Wallet
              </a>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
