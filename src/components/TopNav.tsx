"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

const NAV = [
  { href: "/projects", label: "Projects" },
  { href: "/missions", label: "Missions" },
  { href: "/ai", label: "One AI" },
  { href: "/profile", label: "Profile" },
];

export default function TopNav() {
  const pathname = usePathname();
  const params = useParams<{ projectId?: string }>();
  const [open, setOpen] = useState(false);

  // ✅ Only show admin entry when we are inside /p/[projectId]/...
  const projectId = useMemo(() => {
    const pid = String((params as any)?.projectId || "").trim();
    return pid || "";
  }, [params]);

  const isActive = (href: string) => (pathname || "").startsWith(href);

  // Close dropdown after route change (simple + safe)
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-50 border-b bg-white">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-4 py-3">
        {/* Left: brand */}
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/" className="shrink-0 font-black tracking-wide text-gray-900">
            ONE&nbsp;MISSION
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-2">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-extrabold",
                  isActive(n.href) ? "bg-gray-900 text-white" : "text-gray-900 hover:bg-gray-100"
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right: admin + wallet + mobile menu button */}
        <div className="flex min-w-0 flex-nowrap items-center gap-2">
          {/* ✅ Desktop Admin entry (only inside project context) */}
          {projectId && (
            <Link
              href={`/p/${projectId}/admin/reviews`}
              className="hidden sm:inline-flex h-10 items-center justify-center rounded-xl border border-gray-900 bg-gray-900 px-3 text-sm font-extrabold text-white hover:opacity-90"
              title="Admin Reviews"
            >
              Admin
            </Link>
          )}

          {/* Wallet button: hard-limit width on mobile so it never overflows */}
          <div className="walletWrap w-[148px] sm:w-auto min-w-0 overflow-hidden">
            <WalletMultiButton />
          </div>

          {/* Mobile menu toggle */}
          <button
            type="button"
            className="md:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-white"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span className="text-lg">{open ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      <div className={cn("md:hidden border-t bg-white", open ? "block" : "hidden")}>
        <div className="mx-auto max-w-[1200px] px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-extrabold text-center",
                  isActive(n.href) ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-900"
                )}
              >
                {n.label}
              </Link>
            ))}

            {/* ✅ Mobile Admin entry (only inside project context) */}
            {projectId && (
              <Link
                href={`/p/${projectId}/admin/reviews`}
                onClick={() => setOpen(false)}
                className="col-span-2 rounded-xl bg-gray-900 px-3 py-2 text-sm font-extrabold text-white text-center hover:opacity-90"
              >
                Admin Reviews
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ✅ Tailwind can't easily target wallet-adapter internals, so we clamp it here safely */}
      <style jsx global>{`
        /* prevent wallet button from pushing layout on small screens */
        .walletWrap .wallet-adapter-button {
          width: 100%;
          max-width: 220px;
          justify-content: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          border-radius: 12px;
          padding: 10px 12px;
          font-weight: 800;
        }
        /* make the label smaller on mobile so it fits */
        @media (max-width: 640px) {
          .walletWrap .wallet-adapter-button {
            font-size: 12px;
            padding: 10px 10px;
          }
        }
      `}</style>
    </header>
  );
}
