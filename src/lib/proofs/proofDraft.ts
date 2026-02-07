export type ProofDraft = {
  missionId: string;
  projectId: string;
  wallet: string;
  proofType: "SIGN_MESSAGE";
  message: string;
  signature: string; // base58
  issuedAt: number;  // ms
};

const KEY = "omu_proof_draft_v1";

export function saveDraft(d: ProofDraft) {
  localStorage.setItem(KEY, JSON.stringify(d));
}
export function loadDraft(): ProofDraft | null {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
export function clearDraft() {
  localStorage.removeItem(KEY);
}
