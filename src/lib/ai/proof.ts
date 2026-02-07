import { sha256Hex } from "@/lib/crypto/sha256";

export async function buildSignMessageForDraft({
  domain,
  draft,
  wallet,
  chain
}: {
  domain: string;
  draft: any;
  wallet: string;
  chain: "solana" | "evm";
}) {
  const payload = draft?.payload || {
    type: draft?.assessment?.type,
    title: draft?.assessment?.title,
    description: draft?.assessment?.summary,
    timeISO: new Date().toISOString()
  };

  const payloadHash = await sha256Hex(JSON.stringify(payload));

  return [
    "WAOC ONE AI — PROOF OF CONTRIBUTION",
    "",
    `Domain: ${domain}`,
    `Chain: ${chain}`,
    `Wallet: ${wallet}`,
    `ProofId: ${draft.id}`,
    `Time: ${new Date().toISOString()}`,
    "",
    `PayloadHash: ${payloadHash}`
  ].join("\n");
}
