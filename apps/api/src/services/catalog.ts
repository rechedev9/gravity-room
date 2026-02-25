/**
 * Catalog service — DB queries + hydration + Redis cache for program catalog.
 * Framework-agnostic: no Elysia dependency.
 */
import { eq, and, asc, inArray } from 'drizzle-orm';
import { getDb } from '../db';
import { programTemplates, exercises } from '../db/schema';
import { hydrateProgramDefinition } from '../lib/hydrate-program';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { isRecord } from '@gzclp/shared/type-guards';
import {
  getCachedCatalogList,
  setCachedCatalogList,
  getCachedCatalogDetail,
  setCachedCatalogDetail,
} from '../lib/catalog-cache';
import { logger } from '../lib/logger';

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
  readonly source: string;
  readonly totalWorkouts: number;
  readonly workoutsPerWeek: number;
  readonly cycleLength: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractNumericField(definition: unknown, field: string, fallback: number): number {
  if (!isRecord(definition)) return fallback;
  const value = definition[field];
  return typeof value === 'number' ? value : fallback;
}

function toCatalogEntry(row: typeof programTemplates.$inferSelect): CatalogEntry {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    author: row.author,
    category: row.category,
    source: row.source,
    totalWorkouts: extractNumericField(row.definition, 'totalWorkouts', 0),
    workoutsPerWeek: extractNumericField(row.definition, 'workoutsPerWeek', 0),
    cycleLength: extractNumericField(row.definition, 'cycleLength', 0),
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
  // Check cache first
  const cached = await getCachedCatalogList();
  if (cached && isCatalogEntryArray(cached)) {
    return cached;
  }

  const rows = await getDb()
    .select()
    .from(programTemplates)
    .where(eq(programTemplates.isActive, true))
    .orderBy(asc(programTemplates.name));

  const entries = rows.map(toCatalogEntry);

  // Cache the result (fire-and-forget)
  void setCachedCatalogList(entries);

  return entries;
}

/** Get a fully hydrated ProgramDefinition by ID. Distinguishes not-found from hydration failure. */
export async function getProgramDefinition(programId: string): Promise<GetProgramDefinitionResult> {
  // Check cache first
  const cached = await getCachedCatalogDetail(programId);
  if (cached) return { status: 'found', definition: cached };

  // Fetch template
  const [template] = await getDb()
    .select()
    .from(programTemplates)
    .where(and(eq(programTemplates.id, programId), eq(programTemplates.isActive, true)))
    .limit(1);

  if (!template) return { status: 'not_found' };

  // Collect referenced exercise IDs from the definition
  const exerciseIds = collectExerciseIds(template.definition);

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
    return { status: 'hydration_failed', error: result.error };
  }

  // Cache the result (fire-and-forget)
  void setCachedCatalogDetail(programId, result.value);

  return { status: 'found', definition: result.value };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Extract exercise IDs from day slots, flattened to avoid deep nesting. */
function extractSlotExerciseIds(slots: unknown): string[] {
  if (!Array.isArray(slots)) return [];
  const ids: string[] = [];
  for (const slot of slots) {
    if (!isRecord(slot)) continue;
    const exerciseId = slot['exerciseId'];
    if (typeof exerciseId === 'string') {
      ids.push(exerciseId);
    }
  }
  return ids;
}

/** Extract all unique exercise IDs referenced in a definition JSONB. */
function collectExerciseIds(definition: unknown): string[] {
  const ids = new Set<string>();

  if (!isRecord(definition)) return [];

  // From exercises map
  const defExercises = definition['exercises'];
  if (isRecord(defExercises)) {
    for (const key of Object.keys(defExercises)) {
      ids.add(key);
    }
  }

  // From day slots
  const days = definition['days'];
  if (Array.isArray(days)) {
    for (const day of days) {
      if (!isRecord(day)) continue;
      for (const id of extractSlotExerciseIds(day['slots'])) {
        ids.add(id);
      }
    }
  }

  return [...ids];
}
