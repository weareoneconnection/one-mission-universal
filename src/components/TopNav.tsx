"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

function NavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        textDecoration: "none",
        fontWeight: 800,
        color: active ? "white" : "#111827",
        background: active ? "#111827" : "transparent",
      }}
    >
      {label}
    </Link>
  );
}

function getProjectIdFromPathname(pathname: string) {
  // matches: /p/<projectId>/...
  if (!pathname) return "";
  const parts = pathname.split("/").filter(Boolean); // ["p", "<projectId>", ...]
  if (parts[0] !== "p") return "";
  return parts[1] || "";
}

export default function TopNav() {
  const pathname = usePathname();
  const projectId = getProjectIdFromPathname(pathname);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "white",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        {/* Left */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link
            href="/"
            style={{
              fontWeight: 950,
              fontSize: 18,
              letterSpacing: 0.5,
              textDecoration: "none",
              color: "#111827",
            }}
          >
            ONE&nbsp;MISSION
          </Link>

          <nav style={{ display: "flex", gap: 6 }}>
            <NavLink href="/projects" label="Projects" />
            <NavLink href="/missions" label="Missions" />
            <NavLink href="/ai" label="One AI" />
            <NavLink href="/profile" label="Profile" />

            {/* ✅ 只有在 /p/[projectId]/... 路由下才显示 */}
            {projectId ? (
              <NavLink href={`/p/${projectId}/admin/reviews`} label="Admin" />
            ) : null}
          </nav>
        </div>

        {/* Right */}
        <div>
          <WalletMultiButton />
        </div>
      </div>
    </header>
  );
}
