// apps/web/src/lib/projects/validators.ts
import { z } from "zod";

export const CreateProjectSchema = z.object({
  name: z.string().min(2).max(60),
  website: z.string().url().optional().or(z.literal("")),
  chain: z.literal("solana").default("solana"),
  ownerWallet: z.string().min(20).max(64), // base58 大概范围，严格校验后面再加
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
