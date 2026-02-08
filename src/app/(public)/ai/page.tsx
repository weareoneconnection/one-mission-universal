import AiChat from "@/components/ai/AiChat";

export default function AiPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-white via-white to-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="mb-5 sm:mb-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  One AI
                </div>
                <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                  Draft-first
                </span>
                <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                  JSON-safe
                </span>
                <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                  Calm mode
                </span>
              </div>

              <div className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Turn actions into structured contribution drafts
              </div>
              <div className="mt-1 text-sm leading-relaxed text-slate-600">
                Describe what you did. One AI returns a clean draft you can refine, sign, and submit later — quietly.
              </div>
            </div>

            {/* Right: compact status / hint block */}
            <div className="w-full sm:w-[340px]">
              <div className="rounded-2xl border bg-white p-4 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">Input tips</div>
                <div className="mt-2 space-y-2 text-sm text-slate-600">
                  <div className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />
                    <span>Be specific: action → where → outcome.</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />
                    <span>Add links or evidence if available.</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900" />
                    <span>Drafts start <b>PRIVATE</b>; publish only when ready.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top info cards */}
        <div className="mb-5 grid gap-3 sm:mb-7 sm:grid-cols-3">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">What this does</div>
            <div className="mt-1 text-sm leading-relaxed text-slate-600">
              You describe an action. One AI turns it into a structured draft you can refine, sign, and submit later.
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Privacy by default</div>
            <div className="mt-1 text-sm leading-relaxed text-slate-600">
              Drafts start as <span className="font-semibold text-slate-900">PRIVATE</span>. Switch to{" "}
              <span className="font-semibold text-slate-900">PUBLIC</span> only when you’re ready.
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Good inputs</div>
            <div className="mt-1 text-sm leading-relaxed text-slate-600">
              Prefer verifiable statements. Short, factual, and link-backed works best.
            </div>
          </div>
        </div>

        {/* Main workspace */}
        <div className="rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">Workspace</div>
              <div className="text-xs text-slate-600">
                Create drafts → edit → sign & submit (MVP).
              </div>
            </div>

            {/* Quick examples */}
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                Examples
              </span>
              <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                “Fixed route.ts bug and deployed.”
              </span>
              <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                “Wrote docs + added tests.”
              </span>
              <span className="hidden md:inline-flex rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                “Reviewed PRs + shipped UI polish.”
              </span>
            </div>
          </div>

          <div className="p-3 sm:p-4">
            {/* Subtle inner frame for better focus */}
            <div className="rounded-2xl border bg-gradient-to-b from-white to-slate-50 p-3 sm:p-4">
              <AiChat />
            </div>
          </div>
        </div>

        {/* Footer notes */}
        <div className="mt-5 rounded-2xl border bg-white p-4 shadow-sm sm:mt-7">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-slate-900">Notes</div>
            <span className="rounded-full border bg-white px-3 py-1 text-xs font-semibold text-slate-700">
              Debug-friendly
            </span>
          </div>

          <ul className="mt-3 space-y-2 text-sm text-slate-600">
            <li className="leading-relaxed">
              • If you see <span className="font-semibold text-slate-900">NETWORK_OR_SERVER_ERROR</span>, open DevTools →
              Network → check <span className="font-semibold text-slate-900">/api/ai</span> response.
            </li>
            <li className="leading-relaxed">
              • If a draft appears but the UI crashes, it’s usually a front-end field path mismatch
              (old <span className="font-semibold text-slate-900">assessment</span> vs new{" "}
              <span className="font-semibold text-slate-900">draft.assessment</span>).
            </li>
            <li className="leading-relaxed">
              • Keep the tone calm: no token talk, no price, no promo language.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
