// http-contract.md §5 — Error response shape
import { z } from 'zod/v4';

export const ErrorResponseSchema = z
  .object({
    error: z.string(),
    code: z.string(),
  })
  .strict();
