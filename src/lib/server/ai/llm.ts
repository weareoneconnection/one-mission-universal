// MVP：暂不接 LLM。以后你接 OpenAI/自建模型时，只改这里。
export async function llmJson(_args: any) {
  throw new Error("LLM not connected (MVP mock mode).");
}
