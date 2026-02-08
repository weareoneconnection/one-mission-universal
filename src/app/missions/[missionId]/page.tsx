"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

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

type Phase = "LOADING" | "REDIRECTING" | "ERROR";

function fmtShort(s: string, n = 6) {
  if (!s) return "";
  if (s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

function Spinner() {
  return (
    <span
      aria-label="loading"
      style={{
        width: 16,
        height: 16,
        borderRadius: 999,
        border: "2px solid #e5e7eb",
        borderTopColor: "#111827",
        display: "inline-block",
        animation: "spin 1s linear infinite",
      }}
    />
  );
}

function Pill({ tone, text }: { tone: "neutral" | "green" | "red" | "amber"; text: string }) {
  const map = {
    neutral: { bg: "#f9fafb", bd: "#e5e7eb", fg: "#111827" },
    green: { bg: "#f0fdf4", bd: "#bbf7d0", fg: "#166534" },
    red: { bg: "#fff1f2", bd: "#fecaca", fg: "#991b1b" },
    amber: { bg: "#fffbeb", bd: "#fde68a", fg: "#92400e" },
  }[tone];

  return (
    <span
      style={{
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${map.bd}`,
        background: map.bg,
        color: map.fg,
        fontWeight: 900,
        fontSize: 12,
        whiteSpace: "nowrap",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {text}
    </span>
  );
}

export default function MissionLegacyRedirectPage() {
  const params = useParams<{ missionId: string }>();
  const router = useRouter();

  const missionId = useMemo(() => String(params?.missionId || "").trim(), [params]);
  const [phase, setPhase] = useState<Phase>("LOADING");
  const [msg, setMsg] = useState<string>("Loading mission…");

  const [found, setFound] = useState<Mission | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function resolveAndRedirect() {
    setPhase("LOADING");
    setMsg("Fetching missions index…");
    setError(null);
    setFound(null);

    if (!missionId) {
      setPhase("ERROR");
      setError("Missing missionId in URL.");
      setMsg("Cannot continue.");
      return;
    }

    let cancelled = false;
    const ac = new AbortController();

    // 超时：提升体验（避免一直转圈）
    const timeout = setTimeout(() => ac.abort(), 12_000);

    try {
      const res = await fetch("/api/missions", { cache: "no-store", signal: ac.signal });
      const data = await res.json();

      if (!data?.ok) throw new Error(data?.error || "Failed to load missions");
      const list = Array.isArray(data.missions) ? (data.missions as Mission[]) : [];
      const m = list.find((x) => x.id === missionId) || null;

      if (!m) throw new Error("Mission not found.");
      if (!m.projectId) throw new Error("Mission missing projectId.");

      if (cancelled) return;

      setFound(m);
      setPhase("REDIRECTING");
      setMsg("Redirecting to project space…");

      // ✅ 核心逻辑不变：replace 到新路由
      router.replace(`/p/${m.projectId}/missions/${m.id}`);
    } catch (e: any) {
      if (cancelled) return;

      const isAbort = String(e?.name || "").toLowerCase().includes("abort");
      const message = isAbort
        ? "Request timeout. Your network may be slow. Please retry."
        : String(e?.message || e);

      setPhase("ERROR");
      setError(message);
      setMsg("Failed to resolve mission.");
    } finally {
      clearTimeout(timeout);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      cancelled = true;
    }
  }

  useEffect(() => {
    resolveAndRedirect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId]);

  const title =
    phase === "REDIRECTING" ? "Redirecting…" : phase === "ERROR" ? "Mission" : "Resolving mission…";

  return (
    <main
      style={{
        padding: 20,
        maxWidth: 900,
        margin: "0 auto",
        boxSizing: "border-box",
      }}
    >
      {/* keyframes (inline, no deps) */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          background: "white",
          padding: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 950, margin: 0 }}>{title}</h1>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {phase === "LOADING" && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                <Spinner />
                <Pill tone="neutral" text="LOOKUP" />
              </span>
            )}
            {phase === "REDIRECTING" && <Pill tone="green" text="FOUND → REDIRECT" />}
            {phase === "ERROR" && <Pill tone="red" text="ERROR" />}
          </div>
        </div>

        <div style={{ marginTop: 10, opacity: 0.85, lineHeight: 1.6 }}>{msg}</div>

        {/* Debug / info block (helpful on mobile) */}
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 14,
            border: "1px solid #f3f4f6",
            background: "#f9fafb",
            display: "grid",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>missionId</div>
            <div style={{ fontFamily: "monospace", fontWeight: 900, wordBreak: "break-all" }}>
              {missionId ? fmtShort(missionId, 10) : "—"}
            </div>
          </div>

          {found && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 900 }}>projectId</div>
                <div style={{ fontFamily: "monospace", fontWeight: 900, wordBreak: "break-all" }}>
                  {fmtShort(found.projectId, 10)}
                </div>
              </div>
              <div style={{ fontSize: 13, opacity: 0.9 }}>
                <b>Mission:</b> {found.title}
              </div>
            </>
          )}

          {phase === "ERROR" && error && (
            <div
              style={{
                marginTop: 4,
                padding: 10,
                borderRadius: 12,
                border: "1px solid #fecaca",
                background: "#fff1f2",
                color: "#991b1b",
                fontWeight: 900,
                lineHeight: 1.5,
                wordBreak: "break-word",
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <a
            href="/missions"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "white",
              textDecoration: "none",
              fontWeight: 900,
              color: "#111827",
            }}
          >
            Back to Missions
          </a>

          {phase === "ERROR" && (
            <button
              onClick={resolveAndRedirect}
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid #111827",
                background: "#111827",
                color: "white",
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              Retry
            </button>
          )}

          <a
            href="/profile"
            style={{
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
              background: "white",
              textDecoration: "none",
              fontWeight: 900,
              color: "#111827",
            }}
          >
            Open Profile
          </a>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.65, lineHeight: 1.6 }}>
        This page exists for legacy links. It resolves the mission via <code>/api/missions</code> then redirects to the
        project-scoped route.
      </div>
    </main>
  );
}
