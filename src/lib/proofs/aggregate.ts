// apps/web/src/lib/proofs/aggregate.ts
import { listChainQueueByStatus } from "@/lib/server/chainProofStore";

type QueueItem = {
  userWallet?: string;
  points?: number;
  chainStatus?: string;
};

/**
 * Off-chain 最终态聚合（当前项目真实可用版本）
 * - 以 chainProofStore 队列 FINALIZED 为准（表示已审批/已确认）
 * - points: 所有 FINALIZED 且属于该 wallet 的 item.points 之和
 * - reputation: FINALIZED item 数量（先用最简单规则）
 */
export async function getOffchainTotals(wallet: string): Promise<{
  points: number;
  reputation: number;
}> {
  const items = (await listChainQueueByStatus("FINALIZED")) as QueueItem[];

  const w = wallet.toLowerCase();

  let points = 0;
  let reputation = 0;

  for (const it of items || []) {
    const owner = String(it.userWallet || "").toLowerCase();
    if (!owner || owner !== w) continue;

    points += Number(it.points || 0);
    reputation += 1;
  }

  return { points, reputation };
}
