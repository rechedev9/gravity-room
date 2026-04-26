/**
 * Catalog service — DB queries + hydration + Redis cache for program catalog.
 * Framework-agnostic: no Elysia dependency.
 */
import { eq, and, asc, inArray, sql } from 'drizzle-orm';
import { getDb } from '../db';
import { programTemplates, exercises } from '../db/schema';
import { hydrateProgramDefinition } from '../lib/hydrate-program';
import { collectExerciseIds } from '../lib/definition-utils';
import { computeGenericProgram } from '@gzclp/domain/generic-engine';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import type { GenericWorkoutRow } from '@gzclp/domain/types';
import { PROGRAM_LEVELS } from '@gzclp/domain/catalog';
import type { ProgramLevel } from '@gzclp/domain/catalog';
import { isRecord } from '@gzclp/domain/type-guards';
import {
  getCachedCatalogList,
  setCachedCatalogList,
  getCachedCatalogDetail,
  setCachedCatalogDetail,
} from '../lib/catalog-cache';
import { SingleflightMap } from '../lib/singleflight';
import { logger } from '../lib/logger';
import { ApiError } from '../middleware/error-handler';

// Singleflight instances — one per return type for type safety
const listFlight = new SingleflightMap<readonly CatalogEntry[]>();
const detailFlight = new SingleflightMap<GetProgramDefinitionResult>();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of getProgramDefinition — distinguishes "not found" from "hydration failure". */
export type GetProgramDefinitionResult =
  | { readonly status: 'found'; readonly definition: ProgramDefinition }
  | { readonly status: 'not_found' }
  | { readonly status: 'hydration_failed'; readonly error: unknown };

export interface CatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly author: string;
  readonly category: string;
  readonly level: ProgramLevel;
  readonly source: string;
  readonly totalWorkouts: number;
  readonly workoutsPerWeek: number;
  readonly cycleLength: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Shape returned by the explicit column projection in listPrograms(). */
interface CatalogProjectedRow {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly author: string;
  readonly category: string;
  readonly level: string;
  readonly source: string;
  readonly definition: {
    readonly totalWorkouts: number;
    readonly workoutsPerWeek: number;
    readonly cycleLength: number;
  };
}

const VALID_LEVELS: ReadonlySet<string> = new Set<string>(PROGRAM_LEVELS);

function isValidLevel(value: string): value is ProgramLevel {
  return VALID_LEVELS.has(value);
}

function toLevel(value: string): ProgramLevel {
  return isValidLevel(value) ? value : 'intermediate';
}

function toCatalogEntry(row: CatalogProjectedRow): CatalogEntry {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    author: row.author,
    category: row.category,
    level: toLevel(row.level),
    source: row.source,
    totalWorkouts: row.definition.totalWorkouts,
    workoutsPerWeek: row.definition.workoutsPerWeek,
    cycleLength: row.definition.cycleLength,
  };
}

/** Type guard to validate cached list shape. */
function isCatalogEntryArray(value: unknown): value is readonly CatalogEntry[] {
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true;
  const first = value[0];
  return isRecord(first) && typeof first['id'] === 'string' && typeof first['name'] === 'string';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** List all active program templates as catalog entries. */
export async function listPrograms(): Promise<readonly CatalogEntry[]> {
  // Check cache first — fast path avoids singleflight overhead
  const cached = await getCachedCatalogList();
  if (cached && isCatalogEntryArray(cached)) {
    return cached;
  }

  // Singleflight: only one DB query executes on concurrent cache misses
  return listFlight.run('catalog:list', async () => {
    // Re-check cache — another caller may have populated it while we waited
    const rechecked = await getCachedCatalogList();
    if (rechecked && isCatalogEntryArray(rechecked)) return rechecked;

    const rows = await getDb()
      .select({
        id: programTemplates.id,
        name: programTemplates.name,
        description: programTemplates.description,
        author: programTemplates.author,
        category: programTemplates.category,
        level: programTemplates.level,
        source: programTemplates.source,
        definition: sql<{
          totalWorkouts: number;
          workoutsPerWeek: number;
          cycleLength: number;
        }>`jsonb_build_object(
          'totalWorkouts', (${programTemplates.definition}->>'totalWorkouts')::int,
          'workoutsPerWeek', (${programTemplates.definition}->>'workoutsPerWeek')::int,
          'cycleLength', (${programTemplates.definition}->>'cycleLength')::int
        )`,
      })
      .from(programTemplates)
      .where(eq(programTemplates.isActive, true))
      .orderBy(asc(programTemplates.name));

    const entries = rows.map(toCatalogEntry);

    // Cache the result (fire-and-forget)
    void setCachedCatalogList(entries);

    return entries;
  });
}

/** Get a fully hydrated ProgramDefinition by ID. Distinguishes not-found from hydration failure. */
export async function getProgramDefinition(programId: string): Promise<GetProgramDefinitionResult> {
  // Check cache first — fast path avoids singleflight overhead
  const cached = await getCachedCatalogDetail(programId);
  if (cached) return { status: 'found', definition: cached };

  // Singleflight: only one hydration runs per programId concurrently
  return detailFlight.run(programId, async () => {
    // Re-check cache — another caller may have populated it while we waited
    const rechecked = await getCachedCatalogDetail(programId);
    if (rechecked) return { status: 'found' as const, definition: rechecked };

    // Fetch template
    const [template] = await getDb()
      .select()
      .from(programTemplates)
      .where(and(eq(programTemplates.id, programId), eq(programTemplates.isActive, true)))
      .limit(1);

    if (!template) return { status: 'not_found' as const };

    // Collect referenced exercise IDs from the definition
    const exerciseIds = [...collectExerciseIds(template.definition)];

    // Fetch exercise rows
    const exerciseRows =
      exerciseIds.length > 0
        ? await getDb()
            .select({ id: exercises.id, name: exercises.name })
            .from(exercises)
            .where(inArray(exercises.id, exerciseIds))
        : [];

    // Hydrate
    const result = hydrateProgramDefinition(
      {
        id: template.id,
        name: template.name,
        description: template.description,
        author: template.author,
        version: template.version,
        category: template.category,
        source: template.source,
        definition: template.definition,
      },
      exerciseRows
    );

    if (!result.ok) {
      logger.error({ programId, error: result.error }, 'catalog: hydration failed');
      return { status: 'hydration_failed' as const, error: result.error };
    }

    // Cache the result (fire-and-forget)
    void setCachedCatalogDetail(programId, result.value);

    return { status: 'found' as const, definition: result.value };
  });
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

const MAX_PREVIEW_ROWS = 10;

/**
 * Dry-run a program definition and return the first cycle of workout rows.
 * Pure computation — no DB access, no side effects.
 */
export function previewDefinition(
  definition: ProgramDefinition,
  config?: Record<string, number | string>
): readonly GenericWorkoutRow[] {
  // Build config: use provided values or default to 0 for each weight field
  const resolvedConfig: Record<string, number | string> = {};
  for (const field of definition.configFields) {
    if (field.type === 'weight') {
      resolvedConfig[field.key] = config?.[field.key] ?? 0;
    } else if (field.type === 'select') {
      resolvedConfig[field.key] = config?.[field.key] ?? field.options[0].value;
    }
  }

  try {
    const allRows = computeGenericProgram(definition, resolvedConfig, {});
    return allRows.slice(0, MAX_PREVIEW_ROWS);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown engine error';
    logger.error({ event: 'catalog.preview.engine_error', error: e }, 'preview engine error');
    throw new ApiError(500, `Preview computation failed: ${message}`, 'INTERNAL_ERROR');
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------
