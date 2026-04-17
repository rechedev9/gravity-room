import { z } from 'zod/v4';

export const ProgramSummarySchema = z.object({
  id: z.string().catch(''),
  programId: z.string().catch(''),
  name: z.string().catch(''),
  config: z.record(z.string(), z.union([z.number(), z.string()])).catch({}),
  status: z.string().catch('active'),
  createdAt: z.string().catch(''),
  updatedAt: z.string().catch(''),
});

export type ProgramSummary = z.infer<typeof ProgramSummarySchema>;
