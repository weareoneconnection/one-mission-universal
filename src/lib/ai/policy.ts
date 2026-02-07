const BANNED = [
  "price",
  "pump",
  "moon",
  "guarantee",
  "稳赚",
  "暴富",
  "喊单",
  "带单",
  "马上买",
  "空投猎手",
  "airdrop"
];

export function enforcePolicy(text: string) {
  const lower = String(text || "").toLowerCase();
  for (const w of BANNED) {
    if (lower.includes(w.toLowerCase())) {
      return { ok: false as const, error: "POLICY_BLOCKED", word: w };
    }
  }
  return { ok: true as const };
}
