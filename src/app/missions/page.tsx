// apps/web/src/app/missions/page.tsx
"use client";

import React, { useEffect, useState } from "react";

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

export default function MissionsExplorePage() {
  const [loading, setLoading] = useState(true);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [activeOnly, setActiveOnly] = useState(true);

  async function load() {
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

  useEffect(() => {
    load();
  }, [activeOnly]);

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900 }}>Missions</h1>
          <div style={{ opacity: 0.75, marginTop: 4 }}>
            Explore missions from all projects. (MVP: SIGN_MESSAGE proof)
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Active only
          </label>
          <a href="/projects" style={{ textDecoration: "underline" }}>Projects</a>
          <a href="/dashboard" style={{ textDecoration: "underline" }}>Dashboard</a>
        </div>
      </div>

      {err && <div style={{ marginTop: 12, color: "#b91c1c" }}>{err}</div>}

      {loading ? (
        <div style={{ marginTop: 14, opacity: 0.8 }}>Loading...</div>
      ) : missions.length === 0 ? (
        <div style={{ marginTop: 14, opacity: 0.8 }}>No missions found.</div>
      ) : (
        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
          {missions.map((m) => (
            <a
              key={m.id}
              href={`/missions/${m.id}`}
              style={{
                display: "block",
                padding: 14,
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                textDecoration: "none",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 900 }}>{m.title}</div>
              <div style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>
                projectId: {m.projectId} · proof: {m.proofType} · weight: {m.weight} ·{" "}
                {m.active ? "active" : "inactive"}
              </div>
              {m.description && (
                <div style={{ marginTop: 8, fontSize: 14, opacity: 0.9 }}>{m.description}</div>
              )}
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
