import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import fs from "node:fs";
import path from "node:path";
import { dumpStore } from "@/lib/_internal-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function detectClusterFromRpc(rpc: string) {
  const u = String(rpc || "").toLowerCase();
  if (u.includes("devnet")) return "devnet";
  if (u.includes("testnet")) return "testnet";
  return "mainnet-beta";
}

function env(name: string, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}

function rpcUrl() {
  return env(
    "SOLANA_RPC_URL",
    env("NEXT_PUBLIC_SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
  );
}

function pointsProgramIdStr() {
  return env("WAOC_POINTS_PROGRAM_ID", env("NEXT_PUBLIC_WAOC_POINTS_PROGRAM_ID", ""));
}

function missionProgramIdStr() {
  return env("WAOC_MISSION_PROGRAM_ID", env("NEXT_PUBLIC_WAOC_MISSION_PROGRAM_ID", ""));
}

// ✅ apps/web 的 cwd：process.cwd() === apps/web
function readIdl(filename: string) {
  const p = path.join(process.cwd(), "idl", filename);
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

function toNum(v: any): number {
  try {
    if (v == null) return 0;
    if (typeof v === "number") return v;
    if (typeof v === "bigint") return Number(v);
    if (typeof v === "string") return Number(v);
    if (typeof v?.toNumber === "function") return v.toNumber();
    if (typeof v?.toString === "function") return Number(v.toString());
    return Number(v);
  } catch {
    return 0;
  }
}

// ✅ 自动判断 秒 / 毫秒（长期不会错）
function toMs(ts: number) {
  if (!ts) return 0;
  return ts > 2_000_000_000_000 ? ts : ts * 1000;
}

function derivePointsConfigPda(programId: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("points_config")], programId);
}

function derivePointsPda(owner: PublicKey, programId: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("points"), owner.toBuffer()], programId);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const walletStr = String(searchParams.get("wallet") || "").trim();

  const rpc = rpcUrl();
  const pointsPidStr = pointsProgramIdStr();
  const missionPidStr = missionProgramIdStr();

  // ✅ 永远返回完整结构（前端 normalize 也更稳）
    const cluster = detectClusterFromRpc(rpc);

  const base = {
    ok: true,

    // ✅ 不要写死
    cluster,
    // ✅ 给 UI 一个更直观的字段（很多页面叫 network）
    network: cluster,

    rpc,

    // ✅ 保留你原来的结构
    programs: { points: pointsPidStr || "", mission: missionPidStr || "" },

    // ✅ 关键：给 UI 直接读的 programId（避免 Program not set）
    pointsProgramId: pointsPidStr || "",
    missionProgramId: missionPidStr || "",

    identity: {
      initialized: false,
      identityPda: "",
      createdAt: 0,
      lastUpdatedAt: 0,
      lastUpdatedSlot: 0,
      level: 0,
      badges: [] as string[],
    },
    totals: { points: 0, reputation: 0 },
    accounts: [] as { label: string; address: string }[],
    recentTx: [] as { signature: string; at?: number; type: string }[],
    sync: { status: "UNKNOWN" as string, note: "" as string },
  };


  if (!walletStr) {
    return NextResponse.json({ ...base, ok: false, error: "Missing wallet" }, { status: 400 });
  }
  if (!pointsPidStr) {
    return NextResponse.json({ ...base, ok: false, error: "MISSING_WAOC_POINTS_PROGRAM_ID" }, { status: 500 });
  }

  try {
    const ownerPk = new PublicKey(walletStr);
    const pointsPid = new PublicKey(pointsPidStr);

    // ✅ 读 IDL（确保文件在 apps/web/idl/waoc_points.json）
    const idl = readIdl("waoc_points.json");

    // ✅ 只用 coder 解码（避免 Program.account 带来的 size/layout 报错）
    const coder = new anchor.BorshCoder(idl);

    const connection = new Connection(rpc, "confirmed");
    const [configPda] = derivePointsConfigPda(pointsPid);
    const [pointsPda] = derivePointsPda(ownerPk, pointsPid);

    base.identity.identityPda = pointsPda.toBase58();
    base.accounts = [
      { label: "Points Config", address: configPda.toBase58() },
      { label: "Points Account", address: pointsPda.toBase58() },
    ];

    const acctInfo = await connection.getAccountInfo(pointsPda);

    // 未初始化 points account：也要返回完整结构
    if (!acctInfo) {
      return NextResponse.json({
        ...base,
        sync: {
          status: "NOT_INITIALIZED",
          note: "PointsAccount not initialized. Call initialize_points once to activate on-chain identity.",
        },
      });
    }

    // ✅ decode PointsAccount
    let acc: any;
    try {
      acc = coder.accounts.decode("PointsAccount", acctInfo.data);
    } catch (e: any) {
      return NextResponse.json(
        {
          ...base,
          ok: false,
          error: "DECODE_FAILED_PointsAccount: " + String(e?.message || e),
          debug: {
            cwd: process.cwd(),
            idlName: idl?.metadata?.name || "",
            idlAddress: idl?.address || "",
          },
        },
        { status: 500 }
      );
    }

    const totalPoints = toNum(acc.total_points ?? acc.totalPoints);
    const createdAt = toNum(acc.created_at ?? acc.createdAt);
    const updatedAt = toNum(acc.updated_at ?? acc.updatedAt);

    // ✅ 最近交易（可失败，不影响整体）
    let recentTx: { signature: string; at?: number; type: string }[] = [];
    try {
      const sigs = await connection.getSignaturesForAddress(pointsPda, { limit: 8 });
      recentTx = sigs.map((s) => ({
        signature: s.signature,
        at: s.blockTime ? s.blockTime * 1000 : undefined,
        type: "POINTS_ACCOUNT",
      }));
    } catch {
      recentTx = [];
    }

    return NextResponse.json({
      ...base,
      identity: {
        ...base.identity,
        initialized: true,
        createdAt: toMs(createdAt),
        lastUpdatedAt: toMs(updatedAt),
      },
      totals: { points: totalPoints, reputation: 0 },
      recentTx, // ✅ 关键：输出 recentTx
      sync: { status: "SYNCED", note: "" },
    });
 } catch (e: any) {
  const debug = env("DEBUG_STORE", "") === "1";
  const keys = debug ? Object.keys(await dumpStore()) : [];
  return NextResponse.json(
    {
      ...base,
      ok: false,
      error: String(e?.message || e),
      stack: String(e?.stack || ""),
      ...(debug ? { __storeKeys: keys } : {}),
    },
    { status: 500 }
  );
 }
}