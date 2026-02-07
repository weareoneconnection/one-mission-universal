// apps/web/src/lib/proof-events.ts

export type ProofEventType = "SUBMITTED" | "APPROVED" | "REJECTED" | "REVOKED";

export type ProofSubmitPayload = {
  links?: string[];
  note?: string;
  attachments?: {
    name: string;
    type: string;
    size: number;
    url: string; // MVP: dataURL/base64; later: S3/R2 URL
  }[];
};

export type ProofEvent = {
  id: string;
  type: ProofEventType;
  at: number; // timestamp ms
  by: string; // wallet address
  reason?: string;
  payload?: ProofSubmitPayload; // only meaningful for SUBMITTED
};
