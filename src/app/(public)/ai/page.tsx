import AiChat from "@/components/ai/AiChat";

export default function AiPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-white">
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-3xl font-semibold tracking-tight">One AI</div>
              <div className="mt-1 text-sm opacity-70">
                Turn actions into structured contribution drafts — quietly.
              </div>
            </div>

            {/* Product badges / hints */}
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span className="rounded-full border px-3 py-1 text-xs opacity-70">
                No hype
              </span>
              <span className="rounded-full border px-3 py-1 text-xs opacity-70">
                JSON-safe
              </span>
              <span className="rounded-full border px-3 py-1 text-xs opacity-70">
                Draft-first
              </span>
            </div>
          </div>
        </div>

        {/* Top info cards */}
        <div className="mb-6 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-sm font-medium">What this does</div>
            <div className="mt-1 text-sm opacity-70 leading-relaxed">
              You describe an action. One AI turns it into a structured draft you can
              refine, sign, and submit later.
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-sm font-medium">Privacy by default</div>
            <div className="mt-1 text-sm opacity-70 leading-relaxed">
              Drafts start as <span className="font-medium">PRIVATE</span>. You can switch to{" "}
              <span className="font-medium">PUBLIC</span> only when you’re ready.
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-sm font-medium">Good inputs</div>
            <div className="mt-1 text-sm opacity-70 leading-relaxed">
              Use specific actions (what, where, result). Add links if you have evidence.
            </div>
          </div>
        </div>

        {/* Main workspace */}
        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-medium">Workspace</div>
              <div className="text-xs opacity-70">
                Create drafts → edit → sign & submit (MVP).
              </div>
            </div>

            {/* Quick examples */}
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-black px-3 py-1 text-xs text-white">
                Example
              </span>
              <span className="rounded-full border px-3 py-1 text-xs opacity-70">
                “Fixed a bug in route.ts and deployed.”
              </span>
              <span className="rounded-full border px-3 py-1 text-xs opacity-70">
                “Wrote docs + added tests.”
              </span>
            </div>
          </div>

          <div className="p-4">
            <AiChat />
          </div>
        </div>

        {/* Footer notes */}
        <div className="mt-6 rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-sm font-medium">Notes</div>
          <ul className="mt-2 space-y-1 text-sm opacity-70">
            <li>
              • If you see <span className="font-medium">NETWORK_OR_SERVER_ERROR</span>, open DevTools →
              Network → check <span className="font-medium">/api/ai</span> response.
            </li>
            <li>
              • If a draft appears but the UI crashes, it’s usually a front-end field path issue
              (old <span className="font-medium">assessment</span> vs new{" "}
              <span className="font-medium">draft.assessment</span>).
            </li>
            <li>
              • Keep the tone calm: no token talk, no price, no promo language.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
