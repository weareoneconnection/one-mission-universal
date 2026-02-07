// apps/web/src/lib/missions/validators.ts
import { z } from "zod";

export const ProofTypeSchema = z.literal("SIGN_MESSAGE");

export const CreateMissionSchema = z.object({
  projectId: z.string().min(6),
  title: z.string().min(2).max(80),
  description: z.string().max(500).optional().or(z.literal("")),
  proofType: ProofTypeSchema.default("SIGN_MESSAGE"),
  weight: z.number().int().min(1).max(100000).default(10),
  active: z.boolean().default(true),
});

export type CreateMissionInput = z.infer<typeof CreateMissionSchema>;
