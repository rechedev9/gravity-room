// http-contract.md §8 — Program instance response shapes
import { z } from 'zod/v4';
import { ISO_DATE_REGEX } from '../helpers/assertions';

const ResultEntrySchema = z
  .object({
    result: z.string(),
    amrapReps: z.number().optional(),
    rpe: z.number().optional(),
    setLogs: z.array(z.unknown()).optional(),
  })
  .strict();

export const ResultsMapSchema = z.record(z.string(), z.record(z.string(), ResultEntrySchema));

export const UndoEntrySchema = z
  .object({
    i: z.number(),
    slotId: z.string(),
    prev: z.string().optional(),
    prevRpe: z.number().optional(),
    prevAmrapReps: z.number().optional(),
    prevSetLogs: z.array(z.unknown()).optional(),
  })
  .strict();

export const ProgramInstanceResponseSchema = z
  .object({
    id: z.string(),
    programId: z.string(),
    name: z.string(),
    config: z.unknown(),
    metadata: z.unknown().nullable(),
    status: z.string(),
    results: ResultsMapSchema,
    undoHistory: z.array(UndoEntrySchema),
    resultTimestamps: z.record(z.string(), z.string()),
    completedDates: z.record(z.string(), z.string()),
    definitionId: z.string().nullable(),
    customDefinition: z.unknown().nullable(),
    createdAt: z.string().regex(ISO_DATE_REGEX),
    updatedAt: z.string().regex(ISO_DATE_REGEX),
  })
  .strict();

export const ProgramInstanceListItemSchema = z
  .object({
    id: z.string(),
    programId: z.string(),
    name: z.string(),
    status: z.string(),
    createdAt: z.string().regex(ISO_DATE_REGEX),
    updatedAt: z.string().regex(ISO_DATE_REGEX),
  })
  .strict();

export const ProgramListResponseSchema = z
  .object({
    data: z.array(ProgramInstanceListItemSchema),
    nextCursor: z.string().nullable(),
  })
  .strict();

export const ExportResponseSchema = z
  .object({
    version: z.literal(1),
    exportDate: z.string().regex(ISO_DATE_REGEX),
    programId: z.string(),
    name: z.string(),
    config: z.unknown(),
    results: ResultsMapSchema,
    undoHistory: z.array(UndoEntrySchema),
  })
  .strict();

export { ResultEntrySchema };
