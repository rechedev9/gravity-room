import type { z } from 'zod/v4';
import type { ProgramDefinitionSchema } from '../schemas/program-definition';
import type {
  GenericResultsSchema,
  GenericUndoHistorySchema,
  ProgramInstanceSchema,
  ProgramInstanceMapSchema,
} from '../schemas/instance';

export type ProgramDefinition = z.infer<typeof ProgramDefinitionSchema>;

export type GenericResults = z.infer<typeof GenericResultsSchema>;
export type GenericUndoHistory = z.infer<typeof GenericUndoHistorySchema>;

export type ProgramInstance = z.infer<typeof ProgramInstanceSchema>;
export type ProgramInstanceMap = z.infer<typeof ProgramInstanceMapSchema>;
