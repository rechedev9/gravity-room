// http-contract.md §8 — Result response shapes
import { z } from 'zod/v4';

// POST /programs/:id/undo inner entry — only prev and prevSetLogs, never prevRpe/prevAmrapReps
const UndoEntryInnerSchema = z
  .object({
    i: z.number(),
    slotId: z.string(),
    prev: z.string().optional(),
    prevSetLogs: z.array(z.unknown()).optional(),
  })
  .strict();

// POST /programs/:id/undo returns { undone: entry | null }
export const UndoResponseSchema = z
  .object({
    undone: UndoEntryInnerSchema.nullable(),
  })
  .strict();
