import type { Proof } from "@/lib/types";
import { nanoid } from "nanoid";
import { getStore, setStore } from "./_internal-store";

/**
 * 索引 keys（必须和 proof-store.ts 完全一致）
 */
const KEY_ALL = "proof_index";
const keyUser = (wallet: string) => `proof_index:user:${wallet}`;
const keyProject = (projectId: string) => `proof_index:project:${projectId}`;

type CreateProofInput = {
  projectId: string;
  missionId: string;
  userWallet: string;
  signature: string;
  message?: string;
  payload?: any;
};

async function pushUniqueIndex(key: string, id: string) {
  const ids = ((await getStore(key)) as string[] | undefined) || [];
  if (!ids.includes(id)) {
    ids.push(id);
    await setStore(key, ids);
  }
}

export async function createProof(input: CreateProofInput): Promise<Proof> {
  const projectId = String(input.projectId || "").trim();
  const missionId = String(input.missionId || "").trim();
  const userWallet = String(input.userWallet || "").trim();
  const signature = String(input.signature || "").trim();
  const message = input.message ? String(input.message) : undefined;
  const payload = input.payload;

  if (!projectId) throw new Error("MISSING_PROJECT_ID");
  if (!missionId) throw new Error("MISSING_MISSION_ID");
  if (!userWallet) throw new Error("MISSING_WALLET");
  if (!signature) throw new Error("MISSING_SIGNATURE");

  const now = Date.now();
  const id = `prf_${nanoid(16)}`;

  // ✅ 注意：你的 Proof type 现在要求 points / reputationDelta / updatedAt
  const proof: Proof = {
    id,
    projectId,
    missionId,

    userWallet,
    signature,
    message,

    createdAt: now,
    updatedAt: now,

    events: [],
    currentStatus: "PENDING",

    points: 0,
    reputationDelta: 0,

    payload,
  };

  // 1) 写 proof 实体
  await setStore(`proof:${id}`, proof);

  // 2) 写索引（关键：profile & project 列表都靠它）
  await pushUniqueIndex(KEY_ALL, id);
  await pushUniqueIndex(keyUser(userWallet), id);
  await pushUniqueIndex(keyProject(projectId), id);

  return proof;
}
