/**
 * Hydration layer — reconstructs a ProgramDefinition from a program_templates row
 * and an exercises array. Pure function: no DB calls.
 */
import { ProgramDefinitionSchema } from '@gzclp/shared/schemas/program-definition';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { isRecord } from '@gzclp/shared/type-guards';

import { type Result, ok, err } from './result';
import { collectExerciseIds } from './definition-utils';
export type { Result };
export { ok, err };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TemplateRow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly author: string;
  readonly version: number;
  readonly category: string;
  readonly source: string;
  readonly definition: unknown;
}

export interface ExerciseRow {
  readonly id: string;
  readonly name: string;
}

interface SchemaValidationError {
  readonly code: 'SCHEMA_VALIDATION_FAILED';
  readonly cause: unknown;
}

interface MissingExerciseError {
  readonly code: 'MISSING_EXERCISE_REFERENCE';
  readonly exerciseId: string;
}

interface InvalidDefinitionError {
  readonly code: 'INVALID_DEFINITION';
  readonly message: string;
}

export type HydrationError = SchemaValidationError | MissingExerciseError | InvalidDefinitionError;

// ---------------------------------------------------------------------------
// Hydration
// ---------------------------------------------------------------------------

/**
 * Hydrates a ProgramDefinition from a program_templates row + exercises.
 * The template.definition JSONB contains the structural definition with
 * exercise IDs. Exercise names are resolved from the exercises array.
 *
 * Returns Ok(ProgramDefinition) on success, or a typed Err on failure.
 */
export function hydrateProgramDefinition(
  template: TemplateRow,
  exerciseRows: ReadonlyArray<ExerciseRow>
): Result<ProgramDefinition, HydrationError> {
  if (!isRecord(template.definition)) {
    return err({
      code: 'INVALID_DEFINITION',
      message: `Definition JSONB for program ${template.id} is not a valid object`,
    });
  }

  // Build exercise lookup from the exercises array
  const exerciseLookup = new Map<string, string>();
  for (const row of exerciseRows) {
    exerciseLookup.set(row.id, row.name);
  }

  // Collect all exerciseIds referenced in slots and exercises map
  const referencedIds = collectExerciseIds(template.definition);

  // Check for missing exercise references
  for (const exerciseId of referencedIds) {
    if (!exerciseLookup.has(exerciseId)) {
      return err({ code: 'MISSING_EXERCISE_REFERENCE', exerciseId });
    }
  }

  // Build the exercises map with names from the exercises table
  const exerciseMap: Record<string, { readonly name: string }> = {};
  for (const exerciseId of referencedIds) {
    const name = exerciseLookup.get(exerciseId);
    if (name !== undefined) {
      exerciseMap[exerciseId] = { name };
    }
  }

  // Assemble the full definition
  const hydrated = {
    id: template.id,
    name: template.name,
    description: template.description,
    author: template.author,
    version: template.version,
    category: template.category,
    source: template.source,
    ...template.definition,
    exercises: exerciseMap,
  };

  // Validate against the schema
  const parseResult = ProgramDefinitionSchema.safeParse(hydrated);
  if (!parseResult.success) {
    return err({ code: 'SCHEMA_VALIDATION_FAILED', cause: parseResult.error });
  }

  return ok(parseResult.data);
}
