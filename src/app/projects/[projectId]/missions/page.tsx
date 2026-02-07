"use client";

import React, { useEffect, useState } from "react";
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

export default function ProjectMissionsPage() {
  const params = useParams<{ projectId: string }>();
  const projectId = String(params?.projectId || "");

  const [loading, setLoading] = useState(true);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // create form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState(10);

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
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  async function toggleActive(id: string, active: boolean) {
    setErr(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

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

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900 }}>Project Missions</h1>
          <div style={{ opacity: 0.75, marginTop: 4 }}>projectId: {projectId}</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <a href={`/projects/${projectId}`} style={{ textDecoration: "underline" }}>Project</a>
          <a href="/missions" style={{ textDecoration: "underline" }}>Mission Explore</a>
        </div>
      </div>

      <section style={{ marginTop: 18, padding: 16, border: "1px solid #e5e7eb", borderRadius: 12 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Create Mission</h2>

        <form onSubmit={onCreate} style={{ marginTop: 12, display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontWeight: 700 }}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Follow X / Join Telegram / Retweet"
              style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10 }}
            />
          </div>

          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontWeight: 700 }}>Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Keep it short and verifiable."
              rows={4}
              style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10 }}
            />
          </div>

          <div style={{ display: "grid", gap: 6, maxWidth: 240 }}>
            <label style={{ fontWeight: 700 }}>Weight</label>
            <input
              value={weight}
              onChange={(e) => setWeight(Number(e.target.value))}
              type="number"
              min={1}
              max={100000}
              style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10 }}
            />
            <div style={{ fontSize: 12, opacity: 0.7 }}>MVP uses SIGN_MESSAGE proof only.</div>
          </div>

          <button
            type="submit"
            disabled={title.trim().length < 2}
            style={{
              padding: 12,
              borderRadius: 12,
              border: "1px solid #111827",
              background: "#111827",
              color: "white",
              fontWeight: 800,
              cursor: "pointer",
              opacity: title.trim().length < 2 ? 0.6 : 1,
              width: 180,
            }}
          >
            Create
          </button>

          {err && <div style={{ color: "#b91c1c" }}>{err}</div>}
        </form>
      </section>

      <section style={{ marginTop: 22 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800 }}>Missions</h2>

        {loading ? (
          <div style={{ marginTop: 10, opacity: 0.8 }}>Loading...</div>
        ) : missions.length === 0 ? (
          <div style={{ marginTop: 10, opacity: 0.8 }}>No missions yet.</div>
        ) : (
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            {missions.map((m) => (
              <div key={m.id} style={{ padding: 14, border: "1px solid #e5e7eb", borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 900 }}>{m.title}</div>
                    <div style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>
                      id: {m.id} · proof: {m.proofType} · weight: {m.weight} ·{" "}
                      <b>{m.active ? "active" : "inactive"}</b>
                    </div>
                    {m.description && (
                      <div style={{ marginTop: 8, fontSize: 14, opacity: 0.9 }}>{m.description}</div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    <a
                      href={`/missions/${m.id}`}
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

                    <button
                      onClick={() => toggleActive(m.id, !m.active)}
                      style={{
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid #e5e7eb",
                        background: "white",
                        cursor: "pointer",
                      }}
                    >
                      {m.active ? "Disable" : "Enable"}
                    </button>
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
