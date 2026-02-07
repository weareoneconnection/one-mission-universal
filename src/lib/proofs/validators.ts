import { z } from "zod";

export const SubmitProofSchema = z.object({
  missionId: z.string().min(6),
  projectId: z.string().min(6),
  wallet: z.string().min(32),        // Solana pubkey base58 length ~44
  proofType: z.literal("SIGN_MESSAGE"),
  message: z.string().min(10),
  signature: z.string().min(40),
  issuedAt: z.number().int().positive(),
});

export type SubmitProofInput = z.infer<typeof SubmitProofSchema>;
