"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";

type Project = {
  id: string;
  name: string;
  slug: string;
  website?: string;
  chain: string;
  ownerWallet: string;
  contractAddress?: string;
  createdAt: number;
  updatedAt: number;
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function short(s: string, n = 6) {
  if (!s) return "";
  if (s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}…${s.slice(-n)}`;
}

function safeUrl(u?: string) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  // 容错：用户输入 example.com
  return `https://${s}`;
}

export default function ProjectsPage() {
  const { publicKey, connected } = useWallet();
  const ownerWallet = useMemo(() => publicKey?.toBase58() || "", [publicKey]);

  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [err, setErr] = useState<string | null>(null);

  // create form
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [chain, setChain] = useState("solana");
  const [contractAddress, setContractAddress] = useState("");

  // UI
  const [createOpen, setCreateOpen] = useState(true);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/projects", { cache: "no-store" });
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error || "Failed to load projects");
      setProjects(Array.isArray(data.projects) ? data.projects : []);
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
      setErr("Please connect your wallet first (owner).");
      return;
    }

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          website: website.trim() ? safeUrl(website) : undefined,
          chain: String(chain || "").trim() || "solana",
          ownerWallet,
          contractAddress: contractAddress.trim() || undefined,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        const msg =
          data?.error === "VALIDATION_ERROR"
            ? "Validation error. Check fields."
            : data?.message || data?.error || `Failed to create (${res.status})`;
        throw new Error(msg);
      }

      setName("");
      setWebsite("");
      setChain("solana");
      setContractAddress("");

      // 创建后自动收起表单更“高级”
      setCreateOpen(false);
      await load();
    } catch (e: any) {
      setErr(String(e?.message || e));
    }
  }

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => {
    const total = projects.length;
    const withWebsite = projects.filter((p) => !!p.website).length;
    const withContract = projects.filter((p) => !!(p as any).contractAddress).length;
    const chains = new Set(projects.map((p) => String(p.chain || "").toLowerCase()).filter(Boolean));
    return { total, withWebsite, withContract, chains: chains.size };
  }, [projects]);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-white">
      {/* subtle background */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-gradient-to-b from-gray-50 to-transparent" />

      <main className="relative mx-auto max-w-6xl px-4 py-6 sm:py-10">
        {/* HERO */}
        <section className="rounded-3xl border bg-white shadow-sm">
          <div className="rounded-3xl bg-[radial-gradient(1000px_380px_at_20%_0%,rgba(15,23,42,0.08),transparent),radial-gradient(800px_300px_at_90%_20%,rgba(15,23,42,0.06),transparent)] p-5 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border bg-white px-3 py-1 text-xs font-extrabold text-gray-900">
                    Project Registry
                  </span>
                  <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                    Mobile-first
                  </span>
                  <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                    Clean · Scalable
                  </span>
                </div>

                <h1 className="mt-4 text-3xl font-black tracking-tight text-gray-900 sm:text-4xl">
                  Projects
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-600">
                  Create a project, set the owner wallet, then publish missions into One Mission Universal.
                  Designed for <span className="font-semibold text-gray-900">mobile</span> and built for scale.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                    creator:{" "}
                    {connected && ownerWallet ? (
                      <span className="font-black text-gray-900">
                        {short(ownerWallet, 8)}
                      </span>
                    ) : (
                      <span className="font-black text-red-600">not connected</span>
                    )}
                  </span>

                  <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                    {loading ? "Loading…" : `${stats.total} total`}
                  </span>
                  <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-gray-700">
                    {stats.chains} chain(s)
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-1">
                <a
                  href="/missions"
                  className="rounded-2xl bg-gray-900 px-4 py-3 text-center text-sm font-extrabold text-white shadow-sm hover:bg-black"
                >
                  Explore Missions
                </a>
                <a
                  href="/dashboard"
                  className="rounded-2xl border bg-white px-4 py-3 text-center text-sm font-extrabold text-gray-900 hover:bg-gray-50"
                >
                  Dashboard
                </a>
                <button
                  onClick={load}
                  className="col-span-2 rounded-2xl border bg-white px-4 py-3 text-sm font-extrabold text-gray-900 hover:bg-gray-50 sm:col-span-1"
                >
                  Refresh
                </button>
              </div>
            </div>

            {/* Stats cards */}
            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              <StatCard title="Total projects" value={loading ? "…" : String(stats.total)} />
              <StatCard title="With website" value={loading ? "…" : String(stats.withWebsite)} />
              <StatCard title="With contract" value={loading ? "…" : String(stats.withContract)} />
              <StatCard title="Chains" value={loading ? "…" : String(stats.chains)} />
            </div>
          </div>
        </section>

        {/* Error */}
        {err && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            {err}
          </div>
        )}

        {/* CREATE */}
        <section className="mt-6 rounded-3xl border bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setCreateOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 rounded-3xl p-5 sm:p-6"
          >
            <div className="min-w-0 text-left">
              <div className="text-sm font-extrabold text-gray-900">Create Project</div>
              <div className="mt-1 text-xs leading-relaxed text-gray-600">
                Minimal inputs. Owner wallet is read from your connected wallet.
              </div>
            </div>
            <span className="rounded-full border bg-white px-3 py-1 text-xs font-extrabold text-gray-900">
              {createOpen ? "Collapse" : "Expand"}
            </span>
          </button>

          {createOpen && (
            <div className="border-t p-5 sm:p-6">
              <form onSubmit={onCreate} className="grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Project Name">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. WAOC / My DAO / My App"
                      className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </Field>

                  <Field label="Website (optional)">
                    <input
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      placeholder="weareoneconnection.org"
                      className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </Field>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Chain">
                    <input
                      value={chain}
                      onChange={(e) => setChain(e.target.value)}
                      placeholder="solana / bsc / ethereum ..."
                      className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </Field>

                  <Field label="Contract Address (optional)">
                    <input
                      value={contractAddress}
                      onChange={(e) => setContractAddress(e.target.value)}
                      placeholder="0x... / mint..."
                      className="w-full rounded-2xl border bg-white px-4 py-3 text-sm font-semibold text-gray-900 outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                  </Field>
                </div>

                <Field label="Owner Wallet">
                  <input
                    value={ownerWallet || ""}
                    readOnly
                    placeholder="Connect wallet to fill"
                    className="w-full rounded-2xl border bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none"
                  />
                  {!connected && (
                    <div className="mt-2 text-xs text-gray-600">
                      Tip: connect wallet in{" "}
                      <a href="/dashboard" className="font-extrabold text-gray-900 underline">
                        /dashboard
                      </a>
                      .
                    </div>
                  )}
                </Field>

                <button
                  type="submit"
                  disabled={name.trim().length < 2}
                  className={cn(
                    "rounded-2xl px-4 py-3 text-center text-sm font-extrabold shadow-sm",
                    name.trim().length < 2
                      ? "cursor-not-allowed border bg-gray-100 text-gray-500"
                      : "bg-gray-900 text-white hover:bg-black"
                  )}
                >
                  Create
                </button>
              </form>
            </div>
          )}
        </section>

        {/* LIST */}
        <section className="mt-6">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <div className="text-sm font-extrabold text-gray-900">All Projects</div>
              <div className="mt-1 text-xs text-gray-600">
                Tap a project to open details or manage missions.
              </div>
            </div>
            <div className="text-xs font-semibold text-gray-600">
              {loading ? "Loading…" : `${projects.length} project(s)`}
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : projects.length === 0 ? (
              <div className="rounded-3xl border bg-white p-6 text-sm text-gray-600 shadow-sm">
                No projects yet. Create your first project above.
              </div>
            ) : (
              projects.map((p) => (
                <div key={p.id} className="rounded-3xl border bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="text-base font-black text-gray-900">{p.name}</div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge>chain: <b className="ml-1">{String(p.chain || "-")}</b></Badge>
                        <Badge>slug: <b className="ml-1">{p.slug}</b></Badge>
                        {p.website ? <Badge>website</Badge> : <Badge muted>no website</Badge>}
                        {(p as any).contractAddress ? <Badge>contract</Badge> : <Badge muted>no contract</Badge>}
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-gray-600">
                        <div className="break-all">
                          id: <span className="font-mono font-bold text-gray-900">{p.id}</span>
                        </div>
                        <div className="break-all">
                          owner:{" "}
                          <span className="font-mono font-bold text-gray-900">
                            {short(p.ownerWallet, 10)}
                          </span>
                        </div>
                        {(p as any).contractAddress && (
                          <div className="break-all">
                            contract:{" "}
                            <span className="font-mono font-bold text-gray-900">
                              {short((p as any).contractAddress, 10)}
                            </span>
                          </div>
                        )}
                      </div>

                      {p.website && (
                        <a
                          href={safeUrl(p.website)}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-gray-900 underline"
                        >
                          Visit website
                          <span className="text-xs opacity-70">↗</span>
                        </a>
                      )}
                    </div>

                    <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:grid-cols-1">
                      <a
                        href={`/projects/${p.id}`}
                        className="rounded-2xl border bg-white px-4 py-3 text-center text-sm font-extrabold text-gray-900 hover:bg-gray-50"
                      >
                        Open
                      </a>
                      <a
                        href={`/projects/${p.id}/missions`}
                        className="rounded-2xl bg-gray-900 px-4 py-3 text-center text-sm font-extrabold text-white hover:bg-black"
                      >
                        Manage Missions
                      </a>

                      {/* 你有 admin review 路由的话，这里给一个更“高级”的入口（不影响结构） */}
                      <a
                        href={`/p/${p.id}/admin/reviews`}
                        className="col-span-2 rounded-2xl border bg-white px-4 py-3 text-center text-sm font-extrabold text-gray-900 hover:bg-gray-50 sm:col-span-1"
                      >
                        Admin Reviews
                      </a>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Mobile sticky quick actions (高级感 + 方便) */}
        <div className="sticky bottom-3 mt-8 sm:hidden">
          <div className="rounded-3xl border bg-white p-2 shadow-sm">
            <div className="grid grid-cols-2 gap-2">
              <a
                href="/missions"
                className="rounded-2xl bg-gray-900 px-4 py-3 text-center text-sm font-extrabold text-white"
              >
                Missions
              </a>
              <a
                href="/dashboard"
                className="rounded-2xl border bg-white px-4 py-3 text-center text-sm font-extrabold text-gray-900"
              >
                Dashboard
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ---------- small components ---------- */

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold text-gray-600">{title}</div>
      <div className="mt-1 text-2xl font-black tracking-tight text-gray-900">{value}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <div className="text-xs font-extrabold text-gray-900">{label}</div>
      {children}
    </div>
  );
}

function Badge({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold",
        muted ? "bg-gray-50 text-gray-500" : "bg-white text-gray-900"
      )}
    >
      {children}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="h-4 w-40 animate-pulse rounded bg-gray-200" />
      <div className="mt-3 flex gap-2">
        <div className="h-6 w-24 animate-pulse rounded-full bg-gray-200" />
        <div className="h-6 w-20 animate-pulse rounded-full bg-gray-200" />
        <div className="h-6 w-24 animate-pulse rounded-full bg-gray-200" />
      </div>
      <div className="mt-4 h-3 w-3/4 animate-pulse rounded bg-gray-200" />
      <div className="mt-2 h-3 w-2/3 animate-pulse rounded bg-gray-200" />
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="h-10 animate-pulse rounded-2xl bg-gray-200" />
        <div className="h-10 animate-pulse rounded-2xl bg-gray-200" />
      </div>
    </div>
  );
}
