"use client";

export default function Error({ error }: { error: Error }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="text-lg font-semibold">Something went wrong</div>
      <pre className="mt-2 whitespace-pre-wrap rounded bg-black/5 p-3 text-xs">
        {error?.message || "Unknown error"}
      </pre>
    </div>
  );
}
