export function buildProofMessage(params: {
  domain: string;          // e.g. localhost:3000 or your domain
  wallet: string;
  projectId: string;
  missionId: string;
  missionTitle: string;
  issuedAt: number;
  nonce: string;
}) {
  return [
    "ONE MISSION UNIVERSAL — PROOF OF CONTRIBUTION",
    "",
    `Domain: ${params.domain}`,
    `Wallet: ${params.wallet}`,
    `Project: ${params.projectId}`,
    `Mission: ${params.missionId}`,
    `Title: ${params.missionTitle}`,
    `IssuedAt: ${params.issuedAt}`,
    `Nonce: ${params.nonce}`,
  ].join("\n");
}

export function randomNonce() {
  return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
}
