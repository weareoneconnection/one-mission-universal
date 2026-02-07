// src/lib/types.ts

export type ProofStatus = "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";

export type ProofEventType = "SUBMITTED" | "APPROVED" | "REJECTED" | "REVOKED";

/**
 * ✅ 一定要 export ProofEvent
 * 不然其它文件从 "@/lib/types" import 会报你现在这个错
 */
export type ProofEvent = {
  id: string;
  type: ProofEventType;
  at: number;
  by: string;
  reason?: string;
  payload?: any;
};

/**
 * ✅ Proof 也统一从这里 export
 */
export type Proof = {
  id: string;
  projectId: string;
  missionId: string;

  userWallet: string;
  signature: string;
  message?: string;

  createdAt: number;
  updatedAt: number;

  events: ProofEvent[];

  currentStatus: ProofStatus;

  // points & reputation（你系统已使用）
  points: number;
  reputationDelta: number;

  // 可选字段（你 approve/reject 逻辑可能会写）
  approvedAt?: number;
  approvedBy?: string;
  rejectedAt?: number;
  rejectedBy?: string;
  revokedAt?: number;
  revokedBy?: string;

  // 提交 proof 带的附加信息
  payload?: any;
};
