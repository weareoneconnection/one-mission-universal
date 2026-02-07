// apps/web/src/app/projects/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

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

export default function ProjectsPage() {
  const { publicKey, connected } = useWallet();

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // create form
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const ownerWallet = useMemo(() => publicKey?.toBase58() || "", [publicKey]);

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

    if (!connected || !ownerWallet) {
      setErr("Please connect your Solana wallet first.");
      return;
    }

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          website: website.trim() || undefined,
          chain: "solana",
          ownerWallet,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.ok) {
        const msg =
          data?.error === "VALIDATION_ERROR"
            ? "Validation error. Check name/website/wallet."
            : data?.message || data?.error || "Failed to create project";
        throw new Error(msg);
      }

      setName("");
      setWebsite("");
      await load();
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 800 }}>Projects</h1>
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        Create a project to publish missions into One Mission Universal.
      </p>

      <section style={{ marginTop: 20, padding: 16, border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>Create Project</h2>

        <form onSubmit={onCreate} style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontWeight: 600 }}>Project Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My DAO / My Game / My Community"
              style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10 }}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontWeight: 600 }}>Website (optional)</label>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
              style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10 }}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontWeight: 600 }}>Owner Wallet (Solana)</label>
            <input
              value={ownerWallet || ""}
              readOnly
              placeholder="Connect wallet to fill"
              style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10, opacity: 0.8 }}
            />
            {!connected && (
              <div style={{ fontSize: 13, opacity: 0.7 }}>
                Tip: Connect your wallet on <a href="/dashboard">/dashboard</a> first.
              </div>
            )}
          </div>

          <button
            type="submit"
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid #111827",
              background: "#111827",
              color: "white",
              fontWeight: 700,
              cursor: "pointer",
              opacity: name.trim().length < 2 ? 0.6 : 1,
            }}
            disabled={name.trim().length < 2}
          >
            Create
          </button>

          {err && (
            <div style={{ color: "#b91c1c", fontSize: 14 }}>
              {err}
            </div>
          )}
        </form>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700 }}>All Projects</h2>

        {loading ? (
          <div style={{ marginTop: 12, opacity: 0.8 }}>Loading...</div>
        ) : projects.length === 0 ? (
          <div style={{ marginTop: 12, opacity: 0.8 }}>No projects yet.</div>
        ) : (
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            {projects.map((p) => (
              <div
                key={p.id}
                style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 12 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{p.name}</div>
                    <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>
                      slug: {p.slug} · chain: {p.chain}
                    </div>
                    <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>
                      owner: {p.ownerWallet}
                    </div>
                    {p.website && (
                      <div style={{ fontSize: 13, marginTop: 6 }}>
                        <a href={p.website} target="_blank" rel="noreferrer">
                          {p.website}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* 预留：未来进入项目详情 */}
                  <div style={{ alignSelf: "center" }}>
                    <a
                      href={`/projects/${p.id}`}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                        display: "inline-block",
                        textDecoration: "none",
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
      </section>
    </main>
  );
}
