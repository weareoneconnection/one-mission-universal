"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";

export default function RoleGuard(props: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { connected, publicKey } = useWallet();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    async function check() {
      // 未连接：按 USER 处理
      if (!connected || !publicKey) {
        // 如果你希望未连接也能看 missions/profile，就放行
        setOk(true);
        return;
      }

      try {
        const j = await fetch("/api/me/role", { cache: "no-store" }).then((r) => r.json());
        const role = j?.role || "USER";

        const isProjectArea = pathname.startsWith("/projects") || pathname.startsWith("/dashboard");
        const isUserArea = pathname.startsWith("/missions") || pathname.startsWith("/profile");

        if (role === "OWNER" && isUserArea) {
          router.replace("/projects");
          return;
        }
        if (role === "USER" && isProjectArea) {
          router.replace("/missions");
          return;
        }

        setOk(true);
      } catch {
        setOk(true);
      }
    }

    check();
  }, [connected, publicKey, pathname, router]);

  if (!ok) return null; // 或者你放一个 loading
  return <>{props.children}</>;
}
