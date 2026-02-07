export type ContributionType = "BUILD" | "CARE" | "SHARE" | "CREATE" | "PRESENCE";

export const CONTRIBUTION_TYPES: ContributionType[] = [
  "BUILD",
  "CARE",
  "SHARE",
  "CREATE",
  "PRESENCE"
];

export function guessTypeFromText(text: string): ContributionType {
  const t = text.toLowerCase();
  if (t.includes("help") || t.includes("support") || t.includes("mentor")) return "CARE";
  if (t.includes("share") || t.includes("tweet") || t.includes("post")) return "SHARE";
  if (t.includes("design") || t.includes("create") || t.includes("write")) return "CREATE";
  if (t.includes("meditat") || t.includes("presence") || t.includes("breath")) return "PRESENCE";
  return "BUILD";
}
