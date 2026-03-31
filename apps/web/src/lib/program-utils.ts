import { ProgramDefinitionSchema } from '@gzclp/shared/schemas/program-definition';
import { isRecord } from '@gzclp/shared/type-guards';
import type { ProgramDefinition } from '@gzclp/shared/types/program';

export function parseCustomDefinition(raw: unknown): ProgramDefinition | undefined {
  if (!isRecord(raw)) return undefined;
  const result = ProgramDefinitionSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}
