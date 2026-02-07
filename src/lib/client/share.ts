export async function buildShare({
  draftId,
  platform,
  locale
}: {
  draftId: string;
  platform: "x" | "telegram";
  locale?: "zh" | "en";
}) {
  const r = await fetch("/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ draftId, platform, locale: locale || "zh" })
  });
  return r.json();
}
