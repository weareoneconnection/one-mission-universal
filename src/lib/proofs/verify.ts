import type { Proof, ProofEvent } from "@/lib/types";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { nanoid } from "nanoid";

type VerifyArgs = {
  wallet: string;
  message: string;
  signature: string;
  expectProjectId?: string;
  expectMissionId?: string;
};

/**
 * Verify a signed message proof (Solana ed25519).
 * - wallet: base58 public key
 * - signature: base58 signature (64 bytes)
 * - message: exact string signed
 * - optional: ensure message contains projectId/missionId for stronger binding
 */
export async function verifySignedMessageProof(args: VerifyArgs): Promise<boolean> {
  try {
    const wallet = String(args.wallet || "").trim();
    const message = String(args.message || "");
    const signature = String(args.signature || "").trim();

    if (!wallet || !message || !signature) return false;

    // Optional stronger binding checks (non-breaking)
    if (args.expectProjectId) {
      const pid = String(args.expectProjectId).trim();
      if (pid && !message.includes(pid)) return false;
    }
    if (args.expectMissionId) {
      const mid = String(args.expectMissionId).trim();
      if (mid && !message.includes(mid)) return false;
    }

    const pubkeyBytes = bs58.decode(wallet);
    const sigBytes = bs58.decode(signature);
    const msgBytes = new TextEncoder().encode(message);

    if (pubkeyBytes.length !== 32) return false;
    if (sigBytes.length !== 64) return false;

    return nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
  } catch {
    return false;
  }
}

type BuildInitialArgs = {
  projectId: string;
  missionId: string;
  userWallet: string;
  signature: string;
  message: string;
  issuedAt?: number;
  payload?: {
    links?: string[];
    note?: string;
    attachments?: { name: string; url: string }[];
  };
};

/**
 * Build a Proof object (event-sourcing seed).
 * NOTE: For persistence, prefer createProof() in proof-store.
 * This is kept for compatibility with existing routes.
 */
export function buildInitialProof(input: BuildInitialArgs): Proof {
  const now = Number(input.issuedAt || Date.now());

  const proofId = `prf_${nanoid(16)}`;

  const submittedEvent: ProofEvent = {
    id: `evt_${nanoid(10)}`,
    type: "SUBMITTED" as any, // keep compatible with either string-union or string
    at: now,
    by: input.userWallet,
    payload: input.payload,
  };

  const proof: Proof = {
    id: proofId,
    projectId: input.projectId,
    missionId: input.missionId,
    userWallet: input.userWallet,

    signature: input.signature,
    message: input.message,

    currentStatus: "PENDING",
    points: 0,
    reputationDelta: 0,

    events: [submittedEvent],

    createdAt: now,
    updatedAt: now,
  };

  return proof;
}
