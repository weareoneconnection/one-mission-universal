import { enforcePolicy } from "./policy";
import { guessTypeFromText } from "./taxonomy";

export async function recognizeContribution({
  text,
  locale
}: {
  text: string;
  locale: "zh" | "en";
}) {
  const policy = enforcePolicy(text);
  if (!policy.ok) {
    return {
      ok: true,
      type: "BUILD",
      title: locale === "zh" ? "内容已被克制协议过滤" : "Content filtered by policy",
      summary:
        locale === "zh"
          ? "你的输入包含不适合 One AI 的营销/价格导向词汇。请改为描述具体行动本身。"
          : "Your input contained hype/price-oriented wording. Please describe the action itself.",
      verifiability: "LOW",
      repeatable: false,
      suggestedVisibility: "PRIVATE",
      tags: ["policy-blocked"],
      followups: [
        {
          question: locale === "zh" ? "你具体做了什么行动？" : "What exact action did you take?",
          reason: locale === "zh" ? "One AI 只记录行动，不记录情绪或价格。" : "One AI records actions, not hype."
        }
      ]
    };
  }

  const type = guessTypeFromText(text);

  return {
    ok: true,
    type,
    title: locale === "zh" ? "用户描述的贡献" : "User-described contribution",
    summary:
      locale === "zh"
        ? "这看起来是一项可被结构化记录的行动。One AI 不评价好坏，只帮助你把行动变成可追溯的贡献草稿。"
        : "This appears to be an action that can be structured as a contribution draft. One AI does not judge — it structures.",
    verifiability: "LOW",
    repeatable: false,
    suggestedVisibility: "PRIVATE",
    tags: ["ai-mock", type.toLowerCase()],
    followups: [
      {
        question: locale === "zh" ? "这是一次性事件还是可重复的习惯？" : "Was it one-time or repeatable?",
        reason:
          locale === "zh"
            ? "重复性有助于形成长期贡献模式。"
            : "Repeatability helps define long-term contribution patterns."
      }
    ]
  };
}
