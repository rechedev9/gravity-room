import { z } from 'zod/v4';

export const ProgramDefinitionResponseSchema = z.object({
  id: z.string().catch(''),
  userId: z.string().catch(''),
  definition: z.unknown(),
  status: z.string().catch('draft'),
  createdAt: z.string().catch(''),
  updatedAt: z.string().catch(''),
  deletedAt: z.string().nullable().catch(null),
});

export type ProgramDefinitionResponse = z.infer<typeof ProgramDefinitionResponseSchema>;

export const ProgramDefinitionListResponseSchema = z.object({
  data: z.array(ProgramDefinitionResponseSchema).catch([]),
  total: z.number().int().catch(0),
});
