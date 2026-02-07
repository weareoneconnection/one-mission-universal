export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="h-6 w-40 animate-pulse rounded bg-black/10" />
      <div className="mt-4 space-y-2">
        <div className="h-4 w-2/3 animate-pulse rounded bg-black/10" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-black/10" />
      </div>
    </div>
  );
}
