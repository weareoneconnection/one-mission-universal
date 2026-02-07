// apps/web/src/lib/onchain/waocPointsAdapter.ts
import "server-only";

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import bs58 from "bs58";

// ✅ 确保存在：apps/web/src/idl/waoc_points.json
import waocPointsIdl from "@/idl/waoc_points.json";

export type ChainCallResult =
  | { ok: true; tx: string; pointsPda: string }
  | { ok: false; error: string; detail?: string };

function env(name: string, fallback = "") {
  return (process.env[name] ?? fallback).toString().trim();
}

function getRpcUrl() {
  return env(
    "SOLANA_RPC_URL",
    env("NEXT_PUBLIC_SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com")
  );
}

function getPointsProgramId(): PublicKey {
  const id = env(
    "WAOC_POINTS_PROGRAM_ID",
    env("NEXT_PUBLIC_WAOC_POINTS_PROGRAM_ID", "")
  );
  if (!id) throw new Error("MISSING_WAOC_POINTS_PROGRAM_ID");
  return new PublicKey(id);
}

/**
 * ✅ Turbopack JSON import normalize
 */
const WAOC_IDL: any = (waocPointsIdl as any)?.default ?? waocPointsIdl;

function getAddPointsDiscriminator(): number[] | null {
  const ix = WAOC_IDL?.instructions?.find((i: any) => i?.name === "add_points");
  const disc = ix?.discriminator;
  return Array.isArray(disc) && disc.length === 8 ? disc : null;
}

function loadAdminKeypair(): Keypair {
  const raw = env("WAOC_ADMIN_SECRET_KEY", "");
  if (!raw) throw new Error("MISSING_WAOC_ADMIN_SECRET_KEY");

  // 1) base58 secretKey
  try {
    const bytes = bs58.decode(raw);
    return Keypair.fromSecretKey(bytes);
  } catch {
    // ignore
  }

  // 2) JSON array secretKey
  try {
    const arr = JSON.parse(raw);
    const bytes = Uint8Array.from(arr);
    return Keypair.fromSecretKey(bytes);
  } catch {
    throw new Error("INVALID_WAOC_ADMIN_SECRET_KEY_FORMAT (base58 or JSON array)");
  }
}

function u64le(n: number) {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n));
  return b;
}

/**
 * PDAs (from IDL)
 * - config: seeds ["points_config"]
 * - points: seeds ["points", owner]
 */
export function derivePointsConfigPda(programId?: PublicKey) {
  const pid = programId ?? getPointsProgramId();
  return PublicKey.findProgramAddressSync([Buffer.from("points_config")], pid);
}

export function derivePointsPda(owner: PublicKey, programId?: PublicKey) {
  const pid = programId ?? getPointsProgramId();
  return PublicKey.findProgramAddressSync(
    [Buffer.from("points"), owner.toBuffer()],
    pid
  );
}

/**
 * ✅ Admin adds points onchain (NO Anchor, NO Provider, NO Program)
 */
export async function addPointsOnchain(params: {
  owner: string; // user wallet base58
  amount: number;
  rpcUrl?: string;
}): Promise<ChainCallResult> {
  try {
    const ownerPk = new PublicKey(params.owner);
    const amount = Math.floor(Number(params.amount));
    if (!Number.isFinite(amount) || amount <= 0) {
      return { ok: false, error: "INVALID_AMOUNT" };
    }

    const programId = getPointsProgramId();
    const connection = new Connection(params.rpcUrl || getRpcUrl(), "confirmed");
    const adminKp = loadAdminKeypair();

    const [configPda] = derivePointsConfigPda(programId);
    const [pointsPda] = derivePointsPda(ownerPk, programId);

    // ✅ config must exist
    const configInfo = await connection.getAccountInfo(configPda);
    if (!configInfo) {
      return {
        ok: false,
        error: "CONFIG_NOT_INITIALIZED",
        detail: `points_config PDA not found: ${configPda.toBase58()}`,
      };
    }

    // ✅ points must exist
    const pointsInfo = await connection.getAccountInfo(pointsPda);
    if (!pointsInfo) {
      return {
        ok: false,
        error: "POINTS_ACCOUNT_NOT_INITIALIZED",
        detail: `points PDA not found: ${pointsPda.toBase58()} (user must initialize_points once)`,
      };
    }

    const disc = getAddPointsDiscriminator();
    if (!disc) {
      return {
        ok: false,
        error: "MISSING_DISCRIMINATOR",
        detail: "IDL instruction add_points discriminator not found/invalid in waoc_points.json",
      };
    }

    // data = discriminator(8) + amount(u64 LE)
    const data = Buffer.concat([Buffer.from(disc), u64le(amount)]);

    // accounts order must match IDL: config, points(writable), owner, authority(signer)
    const ix = new TransactionInstruction({
      programId,
      keys: [
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: pointsPda, isSigner: false, isWritable: true },
        { pubkey: ownerPk, isSigner: false, isWritable: false },
        { pubkey: adminKp.publicKey, isSigner: true, isWritable: false },
      ],
      data,
    });

    const tx = new Transaction().add(ix);
    tx.feePayer = adminKp.publicKey;

    // recent blockhash
    const bh = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = bh.blockhash;

    // sign + send
    tx.sign(adminKp);

    const sig = await sendAndConfirmTransaction(connection, tx, [adminKp], {
      commitment: "confirmed",
      skipPreflight: false,
    });

    return { ok: true, tx: sig, pointsPda: pointsPda.toBase58() };
  } catch (e: any) {
    const msg = String(e?.message || e);
    const logs =
      Array.isArray(e?.logs) ? e.logs.join("\n") :
      Array.isArray(e?.error?.logs) ? e.error.logs.join("\n") :
      "";

    return {
      ok: false,
      error: "ONCHAIN_CALL_FAILED",
      detail: logs ? `${msg}\n\n--- logs ---\n${logs}` : msg,
    };
  }
}
// -------------------------
// Compatibility export for cron/chain-sync
// -------------------------
export async function syncIdentityOnchain(input: {
  owner: string;
  totalPoints: number;
  reputation: number;
}): Promise<{ ok: boolean; tx?: string; error?: string; detail?: string }> {
  try {
    // ✅ 尝试复用当前文件里已有的“写链 SET 总分”实现（你不用改其它代码）
    const self: any = module.exports || {}; // CJS fallback
    const mod: any = (await import("./waocPointsAdapter")) as any; // ESM safe

    const candidates = [
      "syncIdentityOnchain",
      "setIdentityTotalsOnchain",
      "setTotalsOnchain",
      "adminSetTotalsOnchain",
      "adminSetIdentityTotals",
      "syncTotalsOnchain",
      "setPointsAccountTotals",
      "adminSetPointsAccountTotals",
      "syncPointsAccountTotals",
      "syncOnchain",
    ];

    for (const name of candidates) {
      const fn = mod?.[name] || self?.[name];
      if (typeof fn === "function" && name !== "syncIdentityOnchain") {
        return await fn(input);
      }
    }

    return {
      ok: false,
      error: "SYNC_NOT_WIRED",
      detail:
        "syncIdentityOnchain added, but no underlying on-chain SET totals function was found in waocPointsAdapter exports. " +
        "Please map syncIdentityOnchain to your real writer (used by /api/profile/onchain/init).",
    };
  } catch (e: any) {
    return { ok: false, error: "SYNC_INTERNAL_ERROR", detail: String(e?.message || e) };
  }
}
