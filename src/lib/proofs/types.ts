export type ProofType = "SIGN_MESSAGE";

export type Proof = {
  id: string;              // prf_xxx
  missionId: string;       // mis_xxx
  projectId: string;       // proj_xxx
  wallet: string;          // base58 pubkey
  proofType: ProofType;    // SIGN_MESSAGE

  message: string;         // signed plaintext
  signature: string;       // base58 signature
  issuedAt: number;        // unix ms

  createdAt: number;       // unix ms
};
