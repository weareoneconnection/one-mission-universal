"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Project = {
  id: string;
  name: string;
  slug: string;
  website?: string;

  // ✅ 如果你 projects 已经加了 contractAddress，这里也兼容
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

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = String(params?.projectId || "");

  const [loading, setLoading] = useState(true);
  const [p, setP] = useState<Project | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 860);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  async function load() {
    if (!projectId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Failed to load projects");

      const found = (data.projects as Project[]).find((x) => x.id === projectId) || null;
      setP(found);
    } catch (e: any) {
      setErr(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  /* =========================
     Styles (UI only)
  ========================= */

  const page: React.CSSProperties = {
    padding: isMobile ? 16 : 26,
    maxWidth: 1120,
    margin: "0 auto",
    boxSizing: "border-box",
    paddingBottom: 80,
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
    padding: isMobile ? 14 : 16,
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

  const mono: React.CSSProperties = {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    wordBreak: "break-all",
    overflowWrap: "anywhere",
  };

  const btnPrimary: React.CSSProperties = {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid #111827",
    background: "#111827",
    color: "white",
    fontWeight: 950,
    textDecoration: "none",
    textAlign: "center",
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
    textAlign: "center",
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

  const navLink: React.CSSProperties = {
    textDecoration: "none",
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "white",
    fontWeight: 950,
    fontSize: 12,
    color: "#111827",
  };

  const errorBox: React.CSSProperties = {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    border: "1px solid #fecaca",
    background: "#fff1f2",
    color: "#991b1b",
    fontWeight: 900,
    lineHeight: 1.5,
  };

  if (!projectId) {
    return (
      <main style={page}>
        <div style={card}>
          <h1 style={{ fontSize: 20, fontWeight: 950, margin: 0 }}>Missing projectId</h1>
          <div style={{ marginTop: 10 }}>
            <a href="/projects" style={{ textDecoration: "underline", fontWeight: 900 }}>
              Back to Projects
            </a>
          </div>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={page}>
        <section style={hero}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <span style={pill}>Project Space</span>
            <span style={{ fontSize: 12, opacity: 0.75 }}>Loading…</span>
          </div>
          <div style={{ marginTop: 12, fontSize: isMobile ? 26 : 34, fontWeight: 950, lineHeight: 1.05 }}>
            Loading project…
          </div>
        </section>
      </main>
    );
  }

  if (err) {
    return (
      <main style={page}>
        <section style={hero}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <span style={pill}>Project Space</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href="/projects" style={navLink}>Projects</a>
              <a href="/missions" style={navLink}>Missions</a>
              <a href="/dashboard" style={navLink}>Dashboard</a>
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: isMobile ? 26 : 34, fontWeight: 950, lineHeight: 1.05 }}>
            Error
          </div>

          <div style={errorBox}>{err}</div>

          <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={load} style={btnGhost}>Retry</button>
            <a href="/projects" style={btnGhost}>Back</a>
          </div>
        </section>
      </main>
    );
  }

  if (!p) {
    return (
      <main style={page}>
        <section style={hero}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <span style={pill}>Project Space</span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <a href="/projects" style={navLink}>Projects</a>
              <a href="/missions" style={navLink}>Missions</a>
              <a href="/dashboard" style={navLink}>Dashboard</a>
            </div>
          </div>

          <div style={{ marginTop: 12, fontSize: isMobile ? 26 : 34, fontWeight: 950, lineHeight: 1.05 }}>
            Project not found
          </div>

          <div style={{ marginTop: 10, opacity: 0.8, lineHeight: 1.6 }}>
            projectId: <code style={mono}>{projectId}</code>
          </div>

          <div style={{ marginTop: 12 }}>
            <a href="/projects" style={{ textDecoration: "underline", fontWeight: 900 }}>
              Back to Projects
            </a>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main style={page}>
      {/* HERO */}
      <section style={hero}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ minWidth: 260, flex: "1 1 680px" }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <span style={pill}>Project Space</span>
              <span style={pill}>{p.chain}</span>
              <span style={{ fontSize: 12, opacity: 0.75 }}>
                updated: {fmtTime(p.updatedAt)} · created: {fmtTime(p.createdAt)}
              </span>
            </div>

            <h1 style={{ marginTop: 10, fontSize: isMobile ? 30 : 40, fontWeight: 950, lineHeight: 1.06, letterSpacing: -0.4 }}>
              {p.name}
            </h1>

            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ ...pill, background: "white" }}>
                slug: <span style={mono}>{p.slug}</span>
              </span>
              <span style={{ ...pill, background: "white" }}>
                id: <span style={mono}>{short(p.id, 10)}</span>
              </span>
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyText(p.id);
                  setToast(ok ? "✅ Copied project id" : "Copy failed");
                  setTimeout(() => setToast(null), 1100);
                }}
                style={miniBtn}
              >
                Copy id
              </button>
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href={`/projects/${p.id}/missions`} style={{ ...btnPrimary, width: isMobile ? "100%" : "auto", minWidth: 170 }}>
                Manage Missions
              </a>
              <button onClick={load} style={{ ...btnGhost, width: isMobile ? "100%" : "auto", minWidth: 120 }}>
                Refresh
              </button>
            </div>

            {toast && <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>{toast}</div>}
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <a href="/projects" style={navLink}>Projects</a>
            <a href="/missions" style={navLink}>Missions</a>
            <a href="/dashboard" style={navLink}>Dashboard</a>
          </div>
        </div>
      </section>

      {/* INFO GRID */}
      <section
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "1.2fr 1fr",
          gap: 12,
        }}
      >
        {/* Owner */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 950 }}>Owner</div>
            <span style={pill}>publisher</span>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <code style={{ ...mono, fontSize: 13 }}>{p.ownerWallet}</code>
            <span style={pill}>{short(p.ownerWallet, 10)}</span>
            <button
              type="button"
              onClick={async () => {
                const ok = await copyText(p.ownerWallet);
                setToast(ok ? "✅ Copied owner wallet" : "Copy failed");
                setTimeout(() => setToast(null), 1100);
              }}
              style={miniBtn}
            >
              Copy
            </button>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
            This wallet is the mission publisher for this project space.
          </div>
        </div>

        {/* Links */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div style={{ fontSize: 14, fontWeight: 950 }}>Project Links</div>
            <span style={pill}>info</span>
          </div>

          <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.7 }}>Website</div>
              <div style={{ marginTop: 6 }}>
                {p.website ? (
                  <a href={p.website} target="_blank" rel="noreferrer" style={{ textDecoration: "underline", fontWeight: 950 }}>
                    {p.website}
                  </a>
                ) : (
                  <span style={{ opacity: 0.7 }}>—</span>
                )}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 950, opacity: 0.7 }}>Contract Address</div>
              <div style={{ marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                {p.contractAddress ? (
                  <>
                    <code style={{ ...mono, fontSize: 13 }}>{p.contractAddress}</code>
                    <button
                      type="button"
                      onClick={async () => {
                        const ok = await copyText(p.contractAddress!);
                        setToast(ok ? "✅ Copied contract" : "Copy failed");
                        setTimeout(() => setToast(null), 1100);
                      }}
                      style={miniBtn}
                    >
                      Copy
                    </button>
                  </>
                ) : (
                  <span style={{ opacity: 0.7 }}>—</span>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
            Contract address is optional (multi-chain ready). You can add it later in your backend/store.
          </div>
        </div>
      </section>

      {/* CTA */}
      <section
        style={{
          marginTop: 12,
          borderRadius: 20,
          padding: isMobile ? 14 : 16,
          color: "white",
          border: "1px solid rgba(255,255,255,0.12)",
          background:
            "radial-gradient(900px 300px at 10% 20%, rgba(255,255,255,0.10), transparent), radial-gradient(700px 260px at 90% 10%, rgba(255,255,255,0.08), transparent), linear-gradient(135deg, #0b1220, #111827 55%, #0b1220)",
          boxShadow: "0 18px 50px rgba(17,24,39,0.18)",
          display: "flex",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ maxWidth: 640 }}>
          <div style={{ fontSize: 15, fontWeight: 950 }}>Next step: publish missions</div>
          <div style={{ marginTop: 6, opacity: 0.9, lineHeight: 1.6, fontSize: 13 }}>
            Missions live inside this project space. Keep tasks clear, weights consistent, and review strict.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", width: isMobile ? "100%" : "auto" }}>
          <a
            href={`/projects/${p.id}/missions`}
            style={{
              ...btnPrimary,
              background: "white",
              color: "#111827",
              border: "1px solid rgba(255,255,255,0.25)",
              width: isMobile ? "100%" : "auto",
              minWidth: 170,
            }}
          >
            Open Mission Manager
          </a>
          <a href="/missions" style={{ ...btnGhost, borderColor: "rgba(255,255,255,0.25)", color: "white", background: "transparent", width: isMobile ? "100%" : "auto" }}>
            Explore Global Missions
          </a>
        </div>
      </section>

      <footer style={{ marginTop: 14, fontSize: 12, opacity: 0.7, lineHeight: 1.7 }}>
        This page currently loads from <code>/api/projects</code> list + local find. (Optimizable later to <code>/api/projects/:id</code>)
      </footer>
    </main>
  );
}
