"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = String(params?.projectId || "");

  const [loading, setLoading] = useState(true);
  const [p, setP] = useState<Project | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (!projectId) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Failed to load projects");

      const found =
        (data.projects as Project[]).find((x) => x.id === projectId) || null;
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

  if (!projectId) {
    return (
      <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Missing projectId</h1>
        <a href="/projects" style={{ textDecoration: "underline" }}>
          Back to Projects
        </a>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Loading...</h1>
      </main>
    );
  }

  if (err) {
    return (
      <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Error</h1>
        <div style={{ marginTop: 8, color: "#b91c1c" }}>{err}</div>
        <div style={{ marginTop: 16 }}>
          <a href="/projects" style={{ textDecoration: "underline" }}>
            Back to Projects
          </a>
        </div>
      </main>
    );
  }

  if (!p) {
    return (
      <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>Project not found</h1>
        <div style={{ marginTop: 8, opacity: 0.7 }}>
          projectId: <code>{projectId}</code>
        </div>
        <div style={{ marginTop: 16 }}>
          <a href="/projects" style={{ textDecoration: "underline" }}>
            Back to Projects
          </a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 950 }}>{p.name}</h1>
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
            id: {p.id} · slug: {p.slug} · chain: {p.chain}
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <a href="/projects" style={{ textDecoration: "underline" }}>Projects</a>
          <a href="/missions" style={{ textDecoration: "underline" }}>Missions</a>
          <a href="/dashboard" style={{ textDecoration: "underline" }}>Dashboard</a>
        </div>
      </header>

      <section style={{ marginTop: 16, padding: 16, border: "1px solid #e5e7eb", borderRadius: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 900 }}>Owner</div>
        <div style={{ marginTop: 6, fontFamily: "monospace", fontSize: 13 }}>
          {p.ownerWallet}
        </div>

        {p.website && (
          <>
            <div style={{ marginTop: 14, fontSize: 14, fontWeight: 900 }}>Website</div>
            <div style={{ marginTop: 6 }}>
              <a href={p.website} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                {p.website}
              </a>
            </div>
          </>
        )}
      </section>

      <section style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <a
          href={`/projects/${p.id}/missions`}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #111827",
            background: "#111827",
            color: "white",
            fontWeight: 900,
            textDecoration: "none",
          }}
        >
          Manage Missions
        </a>

        <button
          onClick={load}
          style={{
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            fontWeight: 900,
            background: "white",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </section>
    </main>
  );
}
