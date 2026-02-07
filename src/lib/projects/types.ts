// apps/web/src/lib/projects/types.ts
export type Chain = "solana"; // MVP 先固定 solana，后续扩展 "evm"

export type Project = {
  id: string;              // proj_xxx
  name: string;
  slug: string;            // url-friendly
  website?: string;
  chain: Chain;            // "solana"
  ownerWallet: string;     // Solana pubkey base58
  createdAt: number;       // unix ms
  updatedAt: number;       // unix ms
};
