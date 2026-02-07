// apps/web/src/lib/server/ai/openai.ts
import OpenAI from "openai";

let cached: OpenAI | null = null;

/**
 * Lazy OpenAI client.
 * - returns null if OPENAI_API_KEY is missing
 * - avoids crashing build/import time
 */
export function getOpenAIClient(): OpenAI | null {
  if (cached) return cached;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  cached = new OpenAI({ apiKey });
  return cached;
}
