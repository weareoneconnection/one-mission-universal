export function isObject(x: any): x is Record<string, any> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}
export const VALIDATORS_VERSION = "v2026-02-07";

export function explainInvalidAssessment(a: any): string | null {
  if (!isObject(a)) return "not_object";
  if (a.ok !== true) return "ok_not_true";
  if (typeof a.type !== "string") return "type_not_string";
  if (typeof a.title !== "string") return "title_not_string";
  if (typeof a.summary !== "string") return "summary_not_string";
  if (typeof a.verifiability !== "string") return "verifiability_not_string";
  if (typeof a.repeatable !== "boolean") return "repeatable_not_boolean";
  if (typeof a.suggestedVisibility !== "string") return "suggestedVisibility_not_string";
  if (!Array.isArray(a.tags)) return "tags_not_array";
  if (!Array.isArray(a.followups)) return "followups_not_array";

  for (let i = 0; i < a.followups.length; i++) {
    const f = a.followups[i];
    if (!isObject(f)) return `followups[${i}]_not_object`;
    if (typeof f.question !== "string") return `followups[${i}].question_not_string`;
    if (typeof f.reason !== "string") return `followups[${i}].reason_not_string`;
  }

  return null; // ✅ valid
}

export function isAssessment(a: any): boolean {
  return explainInvalidAssessment(a) === null;
}
