// apps/web/src/app/api/cron/chain-sync/route.ts
import { NextResponse } from "next/server";
import {
  dequeueProof,
  enqueueProof,
  incFinalizedCount,
  setLastError,
  setLastSyncAt,
} from "@/lib/server/chainQueue";
import { getChainQueueItem, updateChainQueueItem } from "@/lib/server/chainProofStore";
import { getProofById } from "@/lib/proof-store";
import { addPointsOnchain } from "@/lib/onchain/waocPointsAdapter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
// ✅ 新增：让 Vercel Cron 能打到
export async function GET(req: Request) {
  return POST(req);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// optional cron secret
function checkCronAuth(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const got = req.headers.get("x-cron-secret") || "";
  return got === secret;
}

function isRetryableRpcError(msg: string) {
  const m = String(msg || "");
  // 常见可重试：429 / blockhash / timeout / fetch / rate limit
  return (
    m.includes("429") ||
    m.toLowerCase().includes("too many requests") ||
    m.toLowerCase().includes("rate limit") ||
    m.toLowerCase().includes("failed to get recent blockhash") ||
    m.toLowerCase().includes("blockhash") ||
    m.toLowerCase().includes("timeout") ||
    m.toLowerCase().includes("fetch") ||
    m.toLowerCase().includes("network")
  );
}

export async function POST(req: Request) {
  if (!checkCronAuth(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const BATCH = 10;
  const processed: any[] = [];
  let errors = 0;

  await setLastError(null);

  for (let i = 0; i < BATCH; i++) {
    const proofId = await dequeueProof();
    if (!proofId) break;

    try {
      // 1) 读 proof（真实数据源）
      const proof = await getProofById(proofId);
      if (!proof) throw new Error("PROOF_NOT_FOUND");

      // 不是最终态就不应该上链
      if (proof.currentStatus !== "APPROVED") {
        await updateChainQueueItem(proofId, {
          userWallet: proof.userWallet,
          chainStatus: "FAILED",
          lastError: `INVALID_STATUS:${proof.currentStatus}`,
          updatedAt: Date.now(),
        });

        processed.push({ proofId, ok: false, error: `INVALID_STATUS:${proof.currentStatus}` });
        errors++;
        await sleep(150);
        continue;
      }

      // 2) 队列状态：避免重复上链（ADD 模式必须做）
      const item = await getChainQueueItem(proofId);
      if (item?.chainStatus === "FINALIZED") {
        processed.push({
          proofId,
          ok: true,
          skipped: true,
          reason: "ALREADY_FINALIZED",
          tx: item.chainTx,
        });
        await sleep(150);
        continue;
      }

      // 3) 准备上链参数（增量 ADD）
      const owner = String(proof.userWallet || "").trim();
      const amount = Math.floor(Number((proof as any).points ?? 0));
      if (!owner) throw new Error("MISSING_OWNER");
      if (!Number.isFinite(amount) || amount <= 0) throw new Error("INVALID_POINTS_AMOUNT");

      // 先标 SUBMITTED（方便你观察状态）
      await updateChainQueueItem(proofId, {
        userWallet: owner,
        chainStatus: "SUBMITTED",
        lastError: "",
        updatedAt: Date.now(),
      });

      // 4) 上链：复用已跑通的 addPointsOnchain
      const r = await addPointsOnchain({ owner, amount });
      if (!r.ok) {
        throw new Error(String(r.error || "ADD_POINTS_FAILED") + (r.detail ? `: ${r.detail}` : ""));
      }

      // 5) 标记 FINALIZED
      await updateChainQueueItem(proofId, {
        userWallet: owner,
        chainStatus: "FINALIZED",
        chainTx: r.tx,
        lastError: "",
        updatedAt: Date.now(),
      });

      await incFinalizedCount(1);

      processed.push({
        proofId,
        ok: true,
        tx: r.tx,
        added: { owner, amount },
      });

      // 节流：避免 RPC 429
      await sleep(250);
    } catch (e: any) {
      const msg = String(e?.message || e);

      // 可重试错误：回队列（不丢）
      const retryable = isRetryableRpcError(msg);

      // 失败也要落库
      try {
        const p = await getProofById(proofId);
        await updateChainQueueItem(proofId, {
          userWallet: String(p?.userWallet || "").trim(),
          chainStatus: retryable ? "QUEUED" : "FAILED",
          lastError: msg,
          updatedAt: Date.now(),
        });
      } catch {
        // ignore
      }

      if (retryable) {
        // 退避后重试，避免马上再次 429
        await sleep(600);
        await enqueueProof(proofId);

        processed.push({ proofId, ok: false, retry: true, error: msg });
      } else {
        processed.push({ proofId, ok: false, error: msg });
      }

      await setLastError(msg);
      errors++;

      await sleep(150);
    }
  }

  await setLastSyncAt(Date.now());

  return NextResponse.json({ ok: true, processed, errors });
}
