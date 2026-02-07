"use client";

import React, { useEffect, useState } from "react";
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

export default function MissionLegacyRedirectPage() {
  const params = useParams<{ missionId: string }>();
  const router = useRouter();
  const missionId = String(params?.missionId || "");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>("Loading mission...");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!missionId) {
        setMsg("Missing missionId");
        setLoading(false);
        return;
      }

      try {
        // 兼容你现有的 /api/missions（全局列表）
        const res = await fetch("/api/missions", { cache: "no-store" });
        const data = await res.json();

        if (!data?.ok) throw new Error(data?.error || "Failed to load missions");
        const found = (data.missions as Mission[]).find((x) => x.id === missionId) || null;

        if (!found) throw new Error("Mission not found");
        if (!found.projectId) throw new Error("Mission missing projectId");

        if (!cancelled) {
          setMsg("Redirecting to project space...");
          router.replace(`/p/${found.projectId}/missions/${found.id}`);
        }
      } catch (e: any) {
        if (!cancelled) {
          setMsg(`Error: ${String(e?.message || e)}`);
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [missionId, router]);

  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 900 }}>{loading ? "Redirecting..." : "Mission"}</h1>
      <div style={{ marginTop: 10, opacity: 0.85 }}>{msg}</div>
      <div style={{ marginTop: 16 }}>
        <a href="/missions" style={{ textDecoration: "underline" }}>
          Back to Missions
        </a>
      </div>
    </main>
  );
}
