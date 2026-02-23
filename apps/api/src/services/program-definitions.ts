/**
 * Program definitions service — CRUD for user-created program definitions.
 * Framework-agnostic: no Elysia dependency.
 */
import { eq, and, isNull, desc, count } from 'drizzle-orm';
import { getDb } from '../db';
import { programDefinitions } from '../db/schema';
import { ProgramDefinitionSchema } from '@gzclp/shared/schemas/program-definition';
import { ApiError } from '../middleware/error-handler';
import { logger } from '../lib/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ProgramDefinitionRow = typeof programDefinitions.$inferSelect;

type DefinitionStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

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
      updatedAt: new Date(),
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

export async function softDelete(userId: string, id: string): Promise<boolean> {
  const db = getDb();
  const deleted = await db
    .update(programDefinitions)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(programDefinitions.id, id),
        eq(programDefinitions.userId, userId),
        isNull(programDefinitions.deletedAt)
      )
    )
    .returning({ id: programDefinitions.id });

  return deleted.length > 0;
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
      updatedAt: new Date(),
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

  return toResponse(updated);
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
