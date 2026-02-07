export function buildShareText({
  draft,
  platform,
  locale
}: {
  draft: any;
  platform: "x" | "telegram";
  locale: "zh" | "en";
}) {
  const a = draft?.assessment || {};
  const title = a.title || "Contribution";
  const summary = a.summary || "";

  const base =
    locale === "zh"
      ? [
          "今天我把一个行动整理成了“贡献草稿”。",
          `类型：${a.type || "—"}`,
          `要点：${title}`,
          "",
          summary,
          "",
          "不为了宣传谁，只是希望让行动更清晰、可追溯。"
        ].join("\n")
      : [
          "Today I structured an action into a contribution draft.",
          `Type: ${a.type || "—"}`,
          `Point: ${title}`,
          "",
          summary,
          "",
          "Not for promotion — just to make actions clearer and traceable."
        ].join("\n");

  // platform 可做轻微差异（MVP 先不复杂）
  return base;
}
