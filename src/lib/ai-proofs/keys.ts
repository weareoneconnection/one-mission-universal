export const AI_PROOFS_PREFIX = "one:ai:proofs";
export const AI_PROOF_INDEX_KEY = `${AI_PROOFS_PREFIX}:index`;

export function aiProofKey(id: string) {
  return `${AI_PROOFS_PREFIX}:id:${id}`;
}
