export function safeText(t: string) {
  return String(t || "").slice(0, 4000);
}
