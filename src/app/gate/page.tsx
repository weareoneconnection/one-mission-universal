"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";

export default function GatePage() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const [msg, setMsg] = useState("Checking wallet role…");

  useEffect(() => {
    async function go() {
      // 未连接：默认给用户任务页（或者你也可以留在首页）
      if (!connected || !publicKey) {
        router.replace("/missions");
        return;
      }

      try {
        const j = await fetch("/api/me/role", { cache: "no-store" }).then((r) => r.json());
        const landing = j?.landing || "/missions";
        router.replace(landing);
      } catch {
        router.replace("/missions");
      }
    }

    go();
  }, [connected, publicKey, router]);

  return (
    <main style={{ maxWidth: 980, margin: "0 auto", padding: 24 }}>
      <div style={{ fontWeight: 950, fontSize: 16 }}>{msg}</div>
      <div style={{ marginTop: 8, opacity: 0.75, lineHeight: 1.6 }}>
        Redirecting based on wallet ownership (project owner → Projects, others → Missions).
      </div>
    </main>
  );
}
