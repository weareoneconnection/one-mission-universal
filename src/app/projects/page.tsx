// apps/web/src/app/projects/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

type Project = {
  id: string;
  name: string;
  slug: string;
  website?: string;

  // ✅ New
  contractAddress?: string;

  chain: "solana";
  ownerWallet: string;

  createdAt: number;
  updatedAt: number;
};

function short(s: string, n = 8) {
  if (!s) return "-";
  if (s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

function fmtTime(ts?: number) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function ProjectsPage() {
  const { publicKey, connected } = useWallet();
  const ownerWallet = useMemo(() => (publicKey ? publicKey.toBase58() : ""), [publicKey]);
  const locked = !connected || !ownerWallet;

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // create form
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [contractAddress, setContractAddress] = useState("");

  // list controls
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"updated" | "created" | "name">("updated");
  const [toast, setToast] = useState<string | null>(null);

  // ✅ mobile / layout (UI-only)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 860);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Failed to load projects");
      setProjects(data.projects || []);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (locked) {
      setErr("Please connect your wallet first. Only the connected wallet can create a project.");
      return;
    }

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          website: website.trim() || undefined,
          contractAddress: contractAddress.trim() || undefined,
          chain: "solana",
          ownerWallet,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        const msg =
          data?.error === "VALIDATION_ERROR"
            ? "Validation error. Make sure backend schema accepts contractAddress."
            : data?.message || data?.error || "Failed to create project";
        throw new Error(msg);
      }

      setName("");
      setWebsite("");
      setContractAddress("");
      setToast("✅ Project created");
      setTimeout(() => setToast(null), 1200);

      await load();
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = projects.length;
    const withWebsite = projects.filter((p) => !!p.website).length;
    const withContract = projects.filter((p) => !!p.contractAddress).length;
    const lastUpdated = projects.reduce((mx, p) => Math.max(mx, p.updatedAt || p.createdAt || 0), 0);
    return { total, withWebsite, withContract, lastUpdated };
  }, [projects]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return projects.slice();

    return projects.filter((p) => {
      const hay = [p.id, p.name, p.slug, p.website || "", p.contractAddress || "", p.ownerWallet, p.chain]
        .join(" ")
        .toLowerCase();
      return hay.includes(s);
    });
  }, [projects, q]);

  const sorted = useMemo(() => {
    const list = filtered.slice();
    if (sort === "name") list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    else if (sort === "created") list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    else list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    return list;
  }, [filtered, sort]);

  /* =========================
     Styles (mobile-first)
  ========================= */

  const page: React.CSSProperties = {
    padding: isMobile ? 16 : 26,
    maxWidth: 1120,
    margin: "0 auto",
    boxSizing: "border-box",
  };

  const hero: React.CSSProperties = {
    borderRadius: isMobile ? 18 : 22,
    padding: isMobile ? 14 : 18,
    border: "1px solid #e5e7eb",
    background:
      "radial-gradient(1100px 380px at 20% 0%, rgba(17,24,39,0.10), transparent), radial-gradient(800px 300px at 90% 20%, rgba(17,24,39,0.06), transparent)",
    boxShadow: "0 12px 40px rgba(17,24,39,0.06)",
  };

  const card: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    borderRadius: isMobile ? 16 : 18,
    background: "white",
  };

  const pill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#f9fafb",
    fontSize: 12,
    fontWeight: 950,
    whiteSpace: "nowrap",
  };

  const btnPrimary: React.CSSProperties = {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    fontWeight: 950,
    cursor: "pointer",
    textDecoration: "none",
    width: "100%",
  };

  const btnGhost: React.CSSProperties = {
    padding: "12px 14px",
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
    padding: "12px 12px",
    borderRadius: 14,
    border: "1px solid #e5e7eb",
    outline: "none",
    background: "white",
    fontWeight: 800,
    boxSizing: "border-box",
  };

  const label: React.CSSProperties = { fontSize: 13, fontWeight: 950, opacity: 0.75 };
  const mono: React.CSSProperties = {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    wordBreak: "break-all",
    overflowWrap: "anywhere",
  };

  const grid: React.CSSProperties = {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: isMobile ? "1fr" : "1fr 1.35fr", // ✅ 手机单列
    gap: isMobile ? 12 : 14,
  };

  const infoBox: React.CSSProperties = {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#991b1b",
    fontWeight: 900,
    lineHeight: 1.5,
  };

  const miniBtn: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "white",
    cursor: "pointer",
    fontWeight: 950,
    fontSize: 12,
  };

  return (
    <main style={page}>
      {/* HERO */}
      <section style={hero}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ minWidth: 260, flex: "1 1 640px" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={pill}>Project Registry</span>
              <span style={{ fontSize: 12, opacity: 0.75 }}>
                {stats.lastUpdated ? <>Last updated: {fmtTime(stats.lastUpdated)}</> : <>—</>}
              </span>
              <span style={{ fontSize: 12, opacity: 0.75 }}>
                · creator:{" "}
                {connected && ownerWallet ? (
                  <code style={{ ...pill, padding: "4px 8px", background: "#fff", ...mono }}>{short(ownerWallet, 10)}</code>
                ) : (
                  <b>not connected</b>
                )}
              </span>
            </div>

            <h1 style={{ marginTop: 10, fontSize: isMobile ? 30 : 38, fontWeight: 950, lineHeight: 1.06, letterSpacing: -0.4 }}>
              Projects
            </h1>

            <p style={{ marginTop: 10, fontSize: isMobile ? 14 : 15, opacity: 0.86, lineHeight: 1.75, maxWidth: 860 }}>
              Create a project, set owner wallet, and publish missions into One Mission Universal. Mobile-friendly registry —
              clean, fast, scalable.
            </p>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="/missions" style={btnGhost}>Explore Missions</a>
              <a href="/dashboard" style={btnGhost}>Dashboard</a>
              <button onClick={load} style={btnGhost}>{loading ? "Loading…" : "Refresh"}</button>
            </div>

            {err && <div style={infoBox}>{err}</div>}
          </div>

          {/* Stats */}
          <div style={{ flex: "0 0 360px", minWidth: 260 }}>
            <div style={{ ...card, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                <div style={{ fontWeight: 950 }}>Registry Stats</div>
                <span style={pill}>{locked ? "Wallet required" : "Ready"}</span>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <StatRow label="Total projects" value={loading ? "…" : String(stats.total)} />
                <StatRow label="With website" value={loading ? "…" : String(stats.withWebsite)} />
                <StatRow label="With contract" value={loading ? "…" : String(stats.withContract)} />
              </div>

              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
                Connect wallet to create. (Recommended: backend also verify wallet on POST)
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BODY */}
      <section style={grid}>
        {/* Create */}
        <div style={{ ...card, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 950 }}>Create Project</div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75, lineHeight: 1.6 }}>
                Owner is the connected wallet. Contract address is optional (future multi-chain).
              </div>
            </div>
            <span style={pill}>{locked ? "Locked" : "Unlocked"}</span>
          </div>

          <form onSubmit={onCreate} style={{ marginTop: 12, display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={label}>Project Name</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. WAOC Core / One Field / Partner DAO"
                style={{ ...input, opacity: locked ? 0.7 : 1 }}
                disabled={locked}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={label}>Website (optional)</div>
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
                style={{ ...input, opacity: locked ? 0.7 : 1 }}
                disabled={locked}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={label}>Contract Address (optional)</div>
              <input
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="EVM / Solana / multi-chain address…"
                style={{ ...input, ...mono, opacity: locked ? 0.7 : 1 }}
                disabled={locked}
              />
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={label}>Owner Wallet</div>
              <input value={ownerWallet || ""} readOnly placeholder="Connect wallet to fill" style={{ ...input, ...mono, opacity: 0.85 }} />
              {locked && (
                <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.6 }}>
                  Go to{" "}
                  <a href="/dashboard" style={{ textDecoration: "underline", fontWeight: 950 }}>
                    /dashboard
                  </a>{" "}
                  to connect wallet first.
                </div>
              )}
            </div>

            <button
              type="submit"
              style={{
                ...btnPrimary,
                opacity: locked || name.trim().length < 2 ? 0.55 : 1,
                cursor: locked || name.trim().length < 2 ? "not-allowed" : "pointer",
              }}
              disabled={locked || name.trim().length < 2}
            >
              Create Project
            </button>
          </form>
        </div>

        {/* List */}
        <div style={{ ...card, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 950 }}>All Projects</div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
                Search + sort for large registries. Mobile-friendly cards.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as any)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid #e5e7eb",
                  background: "white",
                  fontWeight: 900,
                }}
              >
                <option value="updated">Sort: Updated</option>
                <option value="created">Sort: Created</option>
                <option value="name">Sort: Name</option>
              </select>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name / id / slug / owner / contract…"
              style={input}
            />
          </div>

          {loading ? (
            <div style={{ marginTop: 12, opacity: 0.8 }}>Loading…</div>
          ) : sorted.length === 0 ? (
            <div style={{ marginTop: 12, padding: 14, borderRadius: 14, border: "1px dashed #e5e7eb", opacity: 0.85, lineHeight: 1.6 }}>
              No projects found.
            </div>
          ) : (
            <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
              {sorted.map((p) => (
                <div
                  key={p.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    padding: isMobile ? 12 : 14,
                    background: "white",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: "1 1 560px" }}>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <div style={{ fontSize: 16, fontWeight: 950, lineHeight: 1.2, wordBreak: "break-word" }}>
                          {p.name}
                        </div>
                        <span style={pill}>{p.chain}</span>
                        <span style={{ ...pill, background: "#fff" }}>
                          slug: <span style={mono}>{p.slug}</span>
                        </span>
                      </div>

                      <div style={{ marginTop: 8, display: "grid", gap: 6, fontSize: 13, opacity: 0.88 }}>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ opacity: 0.7 }}>id:</span>
                          <code style={mono}>{p.id}</code>
                          <button
                            type="button"
                            onClick={async () => {
                              const ok = await copyText(p.id);
                              setToast(ok ? "✅ Copied project id" : "Copy failed");
                              setTimeout(() => setToast(null), 1000);
                            }}
                            style={miniBtn}
                          >
                            Copy
                          </button>
                        </div>

                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ opacity: 0.7 }}>owner:</span>
                          <code style={mono}>{p.ownerWallet}</code>
                          <span style={pill}>{short(p.ownerWallet, 10)}</span>
                        </div>

                        {p.contractAddress && (
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ opacity: 0.7 }}>contract:</span>
                            <code style={mono}>{p.contractAddress}</code>
                            <button
                              type="button"
                              onClick={async () => {
                                const ok = await copyText(p.contractAddress!);
                                setToast(ok ? "✅ Copied contract" : "Copy failed");
                                setTimeout(() => setToast(null), 1000);
                              }}
                              style={miniBtn}
                            >
                              Copy
                            </button>
                          </div>
                        )}

                        {p.website && (
                          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ opacity: 0.7 }}>website:</span>
                            <a
                              href={p.website}
                              target="_blank"
                              rel="noreferrer"
                              style={{ textDecoration: "underline", fontWeight: 900 }}
                            >
                              {p.website}
                            </a>
                          </div>
                        )}

                        <div style={{ fontSize: 12, opacity: 0.65 }}>
                          created: {fmtTime(p.createdAt)} · updated: {fmtTime(p.updatedAt)}
                        </div>
                      </div>
                    </div>

                    <div style={{ flex: "0 0 auto", display: "flex", gap: 10, alignItems: "center", width: isMobile ? "100%" : "auto" }}>
                      <a
                        href={`/projects/${p.id}`}
                        style={{
                          ...btnGhost,
                          minWidth: isMobile ? "100%" : 96,
                          textAlign: "center",
                        }}
                      >
                        Open
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {toast && (
            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
              {toast}
            </div>
          )}
        </div>
      </section>

      <footer style={{ marginTop: 16, fontSize: 12, opacity: 0.7, lineHeight: 1.7 }}>
        APIs: <code>/api/projects</code> (GET/POST) · Recommended: enforce wallet ownership on backend POST.
      </footer>
    </main>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <div style={{ opacity: 0.75 }}>{label}</div>
      <div style={{ fontWeight: 950 }}>{value}</div>
    </div>
  );
}
