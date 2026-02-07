// apps/web/src/lib/missions/types.ts
export type ProofType = "SIGN_MESSAGE";

export type Mission = {
  id: string;              // mis_xxx
  projectId: string;       // proj_xxx
  title: string;
  description?: string;
  proofType: ProofType;    // SIGN_MESSAGE
  weight: number;          // integer points weight
  active: boolean;
  createdAt: number;       // unix ms
  updatedAt: number;       // unix ms
};
