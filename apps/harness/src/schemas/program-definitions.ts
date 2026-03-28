// http-contract.md §8 — Program definition response shapes
// Verified against services/program-definitions.ts toResponse() and ProgramDefinitionResponse
// Actual shape: {id, userId, definition, status, createdAt, updatedAt, deletedAt}
// List shape: {data, total}
import { z } from 'zod/v4';
import { ISO_DATE_REGEX } from '../helpers/assertions';

const ProgramDefinitionResponseSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    definition: z.unknown(),
    status: z.string(),
    createdAt: z.string().regex(ISO_DATE_REGEX),
    updatedAt: z.string().regex(ISO_DATE_REGEX),
    deletedAt: z.string().nullable(),
  })
  .strict();

export const ProgramDefinitionListResponseSchema = z
  .object({
    data: z.array(ProgramDefinitionResponseSchema),
    total: z.number(),
  })
  .strict();

export { ProgramDefinitionResponseSchema };
