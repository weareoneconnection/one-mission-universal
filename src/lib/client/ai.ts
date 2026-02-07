export async function postRecognize({
  text,
  locale,
}: {
  text: string;
  locale?: "zh" | "en";
}) {
  const r = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "recognize", // ✅ 明确意图
      text,
      locale: locale || "zh",
    }),
    cache: "no-store",
  });

  // ✅ 先尝试读 body（无论成功/失败都尽量拿到 error 详情）
  const ct = r.headers.get("content-type") || "";
  const data: any = ct.includes("application/json")
    ? await r.json().catch(() => ({}))
    : { ok: false, error: "NON_JSON_RESPONSE", status: r.status, raw: await r.text().catch(() => "") };

  if (!r.ok) {
    // ✅ 透传后端真实 error（比如 EMPTY_INPUT / INVALID_ASSESSMENT / OPENAI_KEY_MISSING）
    return {
      ok: false,
      error: data?.error || `HTTP_${r.status}`,
      status: r.status,
      ...data,
    };
  }

  // ✅ 正常返回
  return data;
}
