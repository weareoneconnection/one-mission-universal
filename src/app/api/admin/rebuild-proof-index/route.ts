import "server-only";
import { NextResponse } from "next/server";
import { getRedis } from "@/lib/server/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const KEY_INDEX = "om:proofs:index:v1";
const keyByWallet = (wallet: string) => `om:proofs:byWallet:${wallet}`;

export async function POST() {
  try {
    const r = await getRedis();

    const proofIds: string[] = [];
    let cursor = "0";

    // 1️⃣ 扫描所有 proof item
    do {
      const [next, keys] = await r.scan(
        cursor,
        "MATCH",
        "om:proofs:item:*",
        "COUNT",
        500
      );
      cursor = next;
      for (const k of keys) {
        const id = k.replace("om:proofs:item:", "");
        if (id) proofIds.push(id);
      }
    } while (cursor !== "0");

    const uniqIds = Array.from(new Set(proofIds));

    // 2️⃣ 重建全局 index
    await r.set(KEY_INDEX, JSON.stringify(uniqIds));

    // 3️⃣ 重建 byWallet 索引
    const byWallet = new Map<string, string[]>();

    for (const id of uniqIds) {
      const raw = await r.get(`om:proofs:item:${id}`);
      if (!raw) continue;

      let obj: any;
      try {
        obj = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        continue;
      }

      const wallet = String(obj?.userWallet || "").trim();
      if (!wallet) continue;

      const arr = byWallet.get(wallet) || [];
      arr.push(id);
      byWallet.set(wallet, arr);
    }

    for (const [wallet, ids] of byWallet.entries()) {
      const uniq = Array.from(new Set(ids));
      await r.set(keyByWallet(wallet), JSON.stringify(uniq));
    }

    return NextResponse.json({
      ok: true,
      rebuilt: {
        proofs: uniqIds.length,
        wallets: byWallet.size,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
