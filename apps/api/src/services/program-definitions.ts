/**
 * Program definitions service — CRUD for user-created program definitions.
 * Framework-agnostic: no Elysia dependency.
 */
import { eq, and, isNull, desc, count, inArray } from 'drizzle-orm';
import { getDb } from '../db';
import { programDefinitions, programTemplates, programInstances, exercises } from '../db/schema';
import { ProgramDefinitionSchema } from '@gzclp/shared/schemas/program-definition';
import { ApiError } from '../middleware/error-handler';
import { logger } from '../lib/logger';
import { invalidateCatalogList, invalidateCatalogDetail } from '../lib/catalog-cache';
import { hydrateProgramDefinition } from '../lib/hydrate-program';
import { isRecord } from '@gzclp/shared/type-guards';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Result type (same pattern as hydrate-program.ts)
// ---------------------------------------------------------------------------

interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

type Result<T, E> = Ok<T> | Err<E>;

function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProgramDefinitionRow = typeof programDefinitions.$inferSelect;

type DefinitionStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

export type DeleteError = 'NOT_FOUND' | 'ACTIVE_INSTANCES_EXIST';

export type ForkError =
  | 'SOURCE_NOT_FOUND'
  | 'FORBIDDEN'
  | 'DEFINITION_LIMIT_REACHED'
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR';

export interface ProgramDefinitionResponse {
  readonly id: string;
  readonly userId: string;
  readonly definition: unknown;
  readonly status: DefinitionStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt: string | null;
}

export interface PaginatedDefinitions {
  readonly data: readonly ProgramDefinitionResponse[];
  readonly total: number;
}

// ---------------------------------------------------------------------------
// Admin helpers
// ---------------------------------------------------------------------------

const MAX_DEFINITIONS_PER_USER = 10;

export function parseAdminUserIds(): ReadonlySet<string> {
  const raw = process.env['ADMIN_USER_IDS'];
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

let adminUserIds: ReadonlySet<string> = parseAdminUserIds();

/** Re-parse admin IDs from env (used in tests). */
export function reloadAdminUserIds(): void {
  adminUserIds = parseAdminUserIds();
}

export function isAdmin(userId: string): boolean {
  return adminUserIds.has(userId);
}

// ---------------------------------------------------------------------------
// Response mapper
// ---------------------------------------------------------------------------

export function toResponse(row: ProgramDefinitionRow): ProgramDefinitionResponse {
  return {
    id: row.id,
    userId: row.userId,
    definition: row.definition,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export async function create(
  userId: string,
  definition: unknown
): Promise<ProgramDefinitionResponse> {
  // Validate definition against shared schema
  const parseResult = ProgramDefinitionSchema.safeParse(definition);
  if (!parseResult.success) {
    throw new ApiError(
      422,
      `Invalid program definition: ${parseResult.error.message}`,
      'VALIDATION_ERROR'
    );
  }

  // Enforce source must be 'custom'
  const parsed = parseResult.data;
  if (parsed.source !== 'custom') {
    throw new ApiError(422, 'Program definition source must be "custom"', 'VALIDATION_ERROR');
  }

  // Check active definition count for user
  const db = getDb();
  const [countResult] = await db
    .select({ value: count() })
    .from(programDefinitions)
    .where(and(eq(programDefinitions.userId, userId), isNull(programDefinitions.deletedAt)));

  const activeCount = countResult?.value ?? 0;
  if (activeCount >= MAX_DEFINITIONS_PER_USER) {
    throw new ApiError(409, 'Definition limit reached (max 10)', 'LIMIT_EXCEEDED');
  }

  // Insert new definition
  const [row] = await db
    .insert(programDefinitions)
    .values({
      userId,
      definition: parsed,
      status: 'draft',
    })
    .returning();

  if (!row) {
    throw new ApiError(500, 'Failed to create program definition', 'INTERNAL_ERROR');
  }

  return toResponse(row);
}

export async function list(
  userId: string,
  offset: number,
  limit: number
): Promise<PaginatedDefinitions> {
  const clampedLimit = Math.min(Math.max(limit, 1), 100);
  const db = getDb();

  const [rows, [totalResult]] = await Promise.all([
    db
      .select()
      .from(programDefinitions)
      .where(and(eq(programDefinitions.userId, userId), isNull(programDefinitions.deletedAt)))
      .orderBy(desc(programDefinitions.updatedAt))
      .limit(clampedLimit)
      .offset(offset),
    db
      .select({ value: count() })
      .from(programDefinitions)
      .where(and(eq(programDefinitions.userId, userId), isNull(programDefinitions.deletedAt))),
  ]);

  return {
    data: rows.map(toResponse),
    total: totalResult?.value ?? 0,
  };
}

export async function getById(
  userId: string,
  id: string
): Promise<ProgramDefinitionResponse | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(programDefinitions)
    .where(
      and(
        eq(programDefinitions.id, id),
        eq(programDefinitions.userId, userId),
        isNull(programDefinitions.deletedAt)
      )
    )
    .limit(1);

  if (!row) return null;
  return toResponse(row);
}

export async function update(
  userId: string,
  id: string,
  definition: unknown
): Promise<ProgramDefinitionResponse> {
  // Validate definition
  const parseResult = ProgramDefinitionSchema.safeParse(definition);
  if (!parseResult.success) {
    throw new ApiError(
      422,
      `Invalid program definition: ${parseResult.error.message}`,
      'VALIDATION_ERROR'
    );
  }

  const parsed = parseResult.data;
  if (parsed.source !== 'custom') {
    throw new ApiError(422, 'Program definition source must be "custom"', 'VALIDATION_ERROR');
  }

  const db = getDb();

  // Fetch current row to determine status reset
  const [current] = await db
    .select({ status: programDefinitions.status })
    .from(programDefinitions)
    .where(
      and(
        eq(programDefinitions.id, id),
        eq(programDefinitions.userId, userId),
        isNull(programDefinitions.deletedAt)
      )
    )
    .limit(1);

  if (!current) {
    throw new ApiError(404, 'Program definition not found', 'NOT_FOUND');
  }

  // Reset status to draft if was pending_review or approved
  const newStatus: DefinitionStatus =
    current.status === 'pending_review' || current.status === 'approved' ? 'draft' : current.status;

  const [updated] = await db
    .update(programDefinitions)
    .set({
      definition: parsed,
      status: newStatus,
    })
    .where(
      and(
        eq(programDefinitions.id, id),
        eq(programDefinitions.userId, userId),
        isNull(programDefinitions.deletedAt)
      )
    )
    .returning();

  if (!updated) {
    throw new ApiError(404, 'Program definition not found', 'NOT_FOUND');
  }

  return toResponse(updated);
}

export async function softDelete(
  userId: string,
  id: string
): Promise<Result<boolean, DeleteError>> {
  const db = getDb();

  // Guard: check for active program instances referencing this definition
  const [activeCountResult] = await db
    .select({ value: count() })
    .from(programInstances)
    .where(and(eq(programInstances.definitionId, id), eq(programInstances.status, 'active')));

  const activeCount = activeCountResult?.value ?? 0;
  if (activeCount > 0) {
    return err('ACTIVE_INSTANCES_EXIST');
  }

  const deleted = await db
    .update(programDefinitions)
    .set({
      deletedAt: new Date(),
    })
    .where(
      and(
        eq(programDefinitions.id, id),
        eq(programDefinitions.userId, userId),
        isNull(programDefinitions.deletedAt)
      )
    )
    .returning({ id: programDefinitions.id });

  return ok(deleted.length > 0);
}

export async function updateStatus(
  actorUserId: string,
  id: string,
  newStatus: DefinitionStatus
): Promise<ProgramDefinitionResponse> {
  const db = getDb();

  // Fetch the definition (no user filter — admin may not be the owner)
  const [row] = await db
    .select()
    .from(programDefinitions)
    .where(and(eq(programDefinitions.id, id), isNull(programDefinitions.deletedAt)))
    .limit(1);

  if (!row) {
    throw new ApiError(404, 'Program definition not found', 'NOT_FOUND');
  }

  const isOwner = row.userId === actorUserId;
  const actorIsAdmin = isAdmin(actorUserId);
  const currentStatus = row.status;

  // Validate state machine transitions + role check
  const isAllowed = validateTransition(currentStatus, newStatus, isOwner, actorIsAdmin);
  if (!isAllowed) {
    throw new ApiError(403, 'Forbidden: invalid status transition', 'FORBIDDEN');
  }

  const [updated] = await db
    .update(programDefinitions)
    .set({
      status: newStatus,
    })
    .where(eq(programDefinitions.id, id))
    .returning();

  if (!updated) {
    throw new ApiError(500, 'Failed to update status', 'INTERNAL_ERROR');
  }

  logger.info(
    { event: 'definition.status_change', actorUserId, id, from: currentStatus, to: newStatus },
    'program definition status changed'
  );

  // Invalidate catalog cache on approval so the new template appears immediately
  if (newStatus === 'approved') {
    const def: unknown = row.definition;
    const programId = isRecord(def) && typeof def['id'] === 'string' ? def['id'] : undefined;
    void invalidateCatalogList();
    if (programId) {
      void invalidateCatalogDetail(programId);
    }
  }

  return toResponse(updated);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract exerciseId strings from an array of raw slot objects. */
function extractSlotExerciseIds(slots: unknown[]): string[] {
  const ids: string[] = [];
  for (const slot of slots) {
    if (isRecord(slot) && typeof slot['exerciseId'] === 'string') {
      ids.push(slot['exerciseId']);
    }
  }
  return ids;
}

/** Collect exercise IDs from a raw definition JSONB (exercises map + day slot references). */
function collectExerciseIdsFromDef(def: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  const defExercises = def['exercises'];
  if (isRecord(defExercises)) {
    for (const key of Object.keys(defExercises)) ids.add(key);
  }
  const days = def['days'];
  if (Array.isArray(days)) {
    for (const day of days) {
      if (!isRecord(day)) continue;
      const slots = day['slots'];
      if (!Array.isArray(slots)) continue;
      for (const id of extractSlotExerciseIds(slots)) ids.add(id);
    }
  }
  return [...ids];
}

// ---------------------------------------------------------------------------
// Fork
// ---------------------------------------------------------------------------

/**
 * Fork a program definition from an existing template or user-owned definition.
 * Creates a new draft definition with source='custom' and '(copia)' suffix.
 */
export async function forkDefinition(
  userId: string,
  sourceId: string,
  sourceType: 'template' | 'definition'
): Promise<Result<ProgramDefinitionResponse, ForkError>> {
  const db = getDb();

  // Check user's definition count
  const [countResult] = await db
    .select({ value: count() })
    .from(programDefinitions)
    .where(and(eq(programDefinitions.userId, userId), isNull(programDefinitions.deletedAt)));

  const activeCount = countResult?.value ?? 0;
  if (activeCount >= MAX_DEFINITIONS_PER_USER) {
    return err('DEFINITION_LIMIT_REACHED');
  }

  // Fetch source definition based on type
  let parsed: import('@gzclp/shared/types/program').ProgramDefinition;

  if (sourceType === 'template') {
    const [template] = await db
      .select({
        id: programTemplates.id,
        name: programTemplates.name,
        description: programTemplates.description,
        author: programTemplates.author,
        version: programTemplates.version,
        category: programTemplates.category,
        source: programTemplates.source,
        definition: programTemplates.definition,
      })
      .from(programTemplates)
      .where(and(eq(programTemplates.id, sourceId), eq(programTemplates.isActive, true)))
      .limit(1);

    if (!template) {
      return err('SOURCE_NOT_FOUND');
    }

    // Collect exercise IDs from the JSONB definition and fetch names from exercises table
    const defRecord = isRecord(template.definition) ? template.definition : {};
    const exerciseIds = collectExerciseIdsFromDef(defRecord);
    const exerciseRows =
      exerciseIds.length > 0
        ? await db
            .select({ id: exercises.id, name: exercises.name })
            .from(exercises)
            .where(inArray(exercises.id, exerciseIds))
        : [];

    // Hydrate using the same function as the catalog service
    const hydrateResult = hydrateProgramDefinition(template, exerciseRows);
    if (!hydrateResult.ok) {
      logger.warn(
        { event: 'definition.fork.hydration_failed', sourceId, error: hydrateResult.error },
        'fork source template hydration failed'
      );
      return err('VALIDATION_ERROR');
    }
    parsed = hydrateResult.value;
  } else {
    const [definition] = await db
      .select({ definition: programDefinitions.definition, userId: programDefinitions.userId })
      .from(programDefinitions)
      .where(and(eq(programDefinitions.id, sourceId), isNull(programDefinitions.deletedAt)))
      .limit(1);

    if (!definition) {
      return err('SOURCE_NOT_FOUND');
    }
    if (definition.userId !== userId) {
      return err('FORBIDDEN');
    }

    // User definitions store the full schema in JSONB (already hydrated)
    const parseResult = ProgramDefinitionSchema.safeParse(definition.definition);
    if (!parseResult.success) {
      logger.warn(
        { event: 'definition.fork.validation_failed', sourceId, sourceType },
        'fork source definition failed validation'
      );
      return err('VALIDATION_ERROR');
    }
    parsed = parseResult.data;
  }

  // Clone with new identity
  const newId = randomUUID();
  const cloned = {
    ...parsed,
    id: newId,
    name: `${parsed.name} (copy)`,
    source: 'custom' as const,
  };

  try {
    const [row] = await db
      .insert(programDefinitions)
      .values({
        userId,
        definition: cloned,
        status: 'draft',
      })
      .returning();

    if (!row) {
      return err('DATABASE_ERROR');
    }

    logger.info(
      { event: 'definition.forked', userId, sourceId, sourceType, newId: row.id },
      'program definition forked'
    );

    return ok(toResponse(row));
  } catch (e: unknown) {
    logger.error(
      { event: 'definition.fork.error', sourceId, sourceType, error: e },
      'fork definition database error'
    );
    return err('DATABASE_ERROR');
  }
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

function validateTransition(
  from: DefinitionStatus,
  to: DefinitionStatus,
  isOwner: boolean,
  actorIsAdmin: boolean
): boolean {
  // Owner transitions
  if (from === 'draft' && to === 'pending_review' && isOwner) return true;
  if (from === 'pending_review' && to === 'draft' && isOwner) return true;

  // Admin transitions
  if (from === 'pending_review' && to === 'approved' && actorIsAdmin) return true;
  if (from === 'pending_review' && to === 'rejected' && actorIsAdmin) return true;

  // All other transitions are forbidden
  return false;
}
