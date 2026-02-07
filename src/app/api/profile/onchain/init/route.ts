import { NextResponse } from "next/server";
import { Connection, PublicKey, SystemProgram, Transaction, Keypair } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import type { Idl } from "@coral-xyz/anchor";
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function env(name: string, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}

function rpcUrl() {
  return env("SOLANA_RPC_URL", env("NEXT_PUBLIC_SOLANA_RPC_URL", "https://api.mainnet-beta.solana.com"));
}

function pointsProgramIdStr() {
  return env("WAOC_POINTS_PROGRAM_ID", env("NEXT_PUBLIC_WAOC_POINTS_PROGRAM_ID", ""));
}

function readIdlFromDisk(filename: string): Idl {
  const p = path.join(process.cwd(), "idl", filename);
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw) as Idl;
}

function derivePointsConfigPda(programId: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("points_config")], programId);
}

function derivePointsPda(owner: PublicKey, programId: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("points"), owner.toBuffer()], programId);
}

function getReadonlyProgram(connection: Connection, programId: PublicKey) {
  const dummy = Keypair.generate();
  const wallet = new NodeWallet(dummy);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });

  const idl = readIdlFromDisk("waoc_points.json");

  // ✅ 兼容写法：构造只用 (idl, provider)
  const program = new anchor.Program(idl as unknown as Idl, provider) as any;

  // ✅ 把 programId 写回去，确保后续 program.programId 可用
  program.programId = programId;

  return program as anchor.Program;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const wallet = String(body?.wallet || "").trim();
    if (!wallet) return NextResponse.json({ ok: false, error: "Missing wallet" }, { status: 400 });

    const rpc = rpcUrl();
    const pidStr = pointsProgramIdStr();
    if (!pidStr) return NextResponse.json({ ok: false, error: "MISSING_WAOC_POINTS_PROGRAM_ID" }, { status: 500 });

    const connection = new Connection(rpc, "confirmed");
    const ownerPk = new PublicKey(wallet);
    const programId = new PublicKey(pidStr);
    const program = getReadonlyProgram(connection, programId);

    const [configPda] = derivePointsConfigPda(program.programId);
    const [pointsPda] = derivePointsPda(ownerPk, program.programId);

    // already initialized?
    const info = await connection.getAccountInfo(pointsPda);
    if (info) {
      return NextResponse.json({ ok: true, alreadyInitialized: true, pointsPda: pointsPda.toBase58(), txBase64: "" });
    }

    // anchor method name: initializePoints (camelCase) for initialize_points
    const m: any = (program as any).methods;
    const call = m?.initializePoints?.() || m?.initialize_points?.();

    if (!call) {
      return NextResponse.json({ ok: false, error: "IDL_MISSING_initialize_points" }, { status: 500 });
    }

    const ix = await call
      .accounts({
        config: configPda,
        points: pointsPda,
        owner: ownerPk,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

    const tx = new Transaction();
    tx.feePayer = ownerPk;
    tx.recentBlockhash = blockhash;
    tx.add(ix);

    const txBase64 = tx.serialize({ requireAllSignatures: false }).toString("base64");

    return NextResponse.json({
      ok: true,
      alreadyInitialized: false,
      pointsPda: pointsPda.toBase58(),
      lastValidBlockHeight,
      txBase64,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
