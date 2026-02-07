import { NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
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

function readIdl(filename: string) {
  const p = path.join(process.cwd(), "idl", filename);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function derivePointsConfigPda(programId: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("points_config")], programId);
}

export async function GET() {
  const rpc = rpcUrl();
  const pointsPidStr = pointsProgramIdStr();

  const base = {
    ok: true,
    cluster: "mainnet-beta",
    rpc,
    programId: pointsPidStr || "",
    configPda: "",
    admin: "",
    missionProgramId: "",
    createdAt: 0,
    updatedAt: 0,
  };

  if (!pointsPidStr) return NextResponse.json({ ...base, ok: false, error: "MISSING_WAOC_POINTS_PROGRAM_ID" }, { status: 500 });

  try {
    const programId = new PublicKey(pointsPidStr);
    const [configPda] = derivePointsConfigPda(programId);
    base.configPda = configPda.toBase58();

    const idl = readIdl("waoc_points.json");
    const coder = new anchor.BorshCoder(idl);
    const connection = new Connection(rpc, "confirmed");

    const info = await connection.getAccountInfo(configPda);
    if (!info) return NextResponse.json({ ...base, ok: false, error: "CONFIG_NOT_INITIALIZED" }, { status: 404 });

    const cfg: any = coder.accounts.decode("PointsConfig", info.data);

    const admin = cfg.admin?.toBase58?.() ?? String(cfg.admin);
    const missionProgramId =
      cfg.mission_program_id?.toBase58?.() ??
      cfg.missionProgramId?.toBase58?.() ??
      "";

    const createdAt = Number(cfg.created_at ?? cfg.createdAt ?? 0);
    const updatedAt = Number(cfg.updated_at ?? cfg.updatedAt ?? 0);

    return NextResponse.json({
      ...base,
      admin,
      missionProgramId,
      createdAt: createdAt ? createdAt * 1000 : 0,
      updatedAt: updatedAt ? updatedAt * 1000 : 0,
    });
  } catch (e: any) {
    return NextResponse.json({ ...base, ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
