export type AiContributionType =
  | "BUILD"
  | "SUPPORT"
  | "RESEARCH"
  | "ADVOCACY"
  | "PRESENCE";

export type AiVerifiability = "LOW" | "MEDIUM" | "HIGH";
export type AiVisibility = "PRIVATE" | "PUBLIC";

export type AiFollowup = {
  question: string;
  reason?: string;
};

export type AiAssessment = {
  ok: true;
  type: AiContributionType;
  title: string;
  summary: string;
  verifiability: AiVerifiability;
  repeatable: boolean; // 先跟你现有一致（未来再升级枚举）
  suggestedVisibility: AiVisibility;
  tags: string[];
  followups: AiFollowup[];
};

export type AiDraftPayload = {
  type: AiContributionType;
  title: string;
  description: string;
  timeISO: string;
  links: string[];
  tags: string[];
  visibility: AiVisibility;
  verifiability: AiVerifiability;
  repeatable: boolean;
};

export type AiProofStatus = "DRAFT" | "SUBMITTED";

export type AiProofDraft = {
  id: string;
  createdAt: number;
  updatedAt: number;
  assessment: AiAssessment;
  payload: AiDraftPayload;
  status: AiProofStatus;

  // 预留：未来你要保存签名/链信息
  signature?: string;
  wallet?: string;
  chain?: "solana" | "evm";
};
