import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  smallint,
  serial,
  index,
  unique,
  boolean,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const instanceStatusEnum = pgEnum('instance_status', ['active', 'completed', 'archived']);

export const resultTypeEnum = pgEnum('result_type', ['success', 'fail']);

export const programDefinitionStatusEnum = pgEnum('program_definition_status', [
  'draft',
  'pending_review',
  'approved',
  'rejected',
]);

// ---------------------------------------------------------------------------
// users — Google OAuth identity
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: uuid().defaultRandom().primaryKey(),
  email: varchar({ length: 255 }).unique().notNull(),
  googleId: varchar('google_id', { length: 255 }).unique().notNull(),
  name: varchar({ length: 100 }),
  avatarUrl: text('avatar_url'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  refreshTokens: many(refreshTokens),
  programInstances: many(programInstances),
  programDefinitions: many(programDefinitions),
}));

// ---------------------------------------------------------------------------
// refresh_tokens — JWT refresh token rotation
// ---------------------------------------------------------------------------

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: varchar('token_hash', { length: 64 }).unique().notNull(),
    /**
     * Hash of the token that was rotated into this one.
     * When a refresh token is presented but not found (it was rotated away),
     * we search by previousTokenHash to detect token reuse — a sign of theft.
     * If found, we revoke all sessions for the user.
     */
    previousTokenHash: varchar('previous_token_hash', { length: 64 }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('refresh_tokens_user_id_idx').on(table.userId),
    index('refresh_tokens_expires_at_idx').on(table.expiresAt),
    index('refresh_tokens_prev_hash_idx').on(table.previousTokenHash),
  ]
);

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, { fields: [refreshTokens.userId], references: [users.id] }),
}));

// ---------------------------------------------------------------------------
// program_instances — user's active/archived programs
// ---------------------------------------------------------------------------

export const programInstances = pgTable(
  'program_instances',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    programId: varchar('program_id', { length: 50 }).notNull(),
    name: varchar({ length: 100 }).notNull(),
    config: jsonb().notNull(),
    status: instanceStatusEnum().notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('program_instances_user_status_idx').on(table.userId, table.status)]
);

export const programInstancesRelations = relations(programInstances, ({ one, many }) => ({
  user: one(users, { fields: [programInstances.userId], references: [users.id] }),
  programTemplate: one(programTemplates, {
    fields: [programInstances.programId],
    references: [programTemplates.id],
  }),
  workoutResults: many(workoutResults),
  undoEntries: many(undoEntries),
}));

// ---------------------------------------------------------------------------
// workout_results — normalized results (replaces JSONB blob)
// ---------------------------------------------------------------------------

export const workoutResults = pgTable(
  'workout_results',
  {
    id: serial().primaryKey(),
    instanceId: uuid('instance_id')
      .references(() => programInstances.id, { onDelete: 'cascade' })
      .notNull(),
    workoutIndex: smallint('workout_index').notNull(),
    slotId: varchar('slot_id', { length: 50 }).notNull(),
    result: resultTypeEnum().notNull(),
    amrapReps: smallint('amrap_reps'),
    rpe: smallint('rpe'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('workout_results_instance_slot_idx').on(
      table.instanceId,
      table.workoutIndex,
      table.slotId
    ),
    index('workout_results_instance_id_idx').on(table.instanceId),
  ]
);

export const workoutResultsRelations = relations(workoutResults, ({ one }) => ({
  instance: one(programInstances, {
    fields: [workoutResults.instanceId],
    references: [programInstances.id],
  }),
}));

// ---------------------------------------------------------------------------
// undo_entries — ordered undo stack (LIFO via serial PK)
// ---------------------------------------------------------------------------

export const undoEntries = pgTable(
  'undo_entries',
  {
    id: serial().primaryKey(),
    instanceId: uuid('instance_id')
      .references(() => programInstances.id, { onDelete: 'cascade' })
      .notNull(),
    workoutIndex: smallint('workout_index').notNull(),
    slotId: varchar('slot_id', { length: 50 }).notNull(),
    prevResult: resultTypeEnum('prev_result'),
    prevAmrapReps: smallint('prev_amrap_reps'),
    prevRpe: smallint('prev_rpe'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('undo_entries_instance_id_idx').on(table.instanceId)]
);

export const undoEntriesRelations = relations(undoEntries, ({ one }) => ({
  instance: one(programInstances, {
    fields: [undoEntries.instanceId],
    references: [programInstances.id],
  }),
}));

// ---------------------------------------------------------------------------
// program_definitions — user-created program definitions
// ---------------------------------------------------------------------------

export const programDefinitions = pgTable(
  'program_definitions',
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    definition: jsonb().notNull(),
    status: programDefinitionStatusEnum().notNull().default('draft'),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('program_definitions_user_id_idx').on(table.userId),
    index('program_definitions_status_idx').on(table.status),
  ]
);

export const programDefinitionsRelations = relations(programDefinitions, ({ one }) => ({
  user: one(users, { fields: [programDefinitions.userId], references: [users.id] }),
}));

// ---------------------------------------------------------------------------
// muscle_groups — exercise categorization
// ---------------------------------------------------------------------------

export const muscleGroups = pgTable('muscle_groups', {
  id: varchar({ length: 50 }).primaryKey(),
  name: varchar({ length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// exercises — canonical exercise catalog
// ---------------------------------------------------------------------------

export const exercises = pgTable(
  'exercises',
  {
    id: varchar({ length: 50 }).primaryKey(),
    name: varchar({ length: 100 }).notNull(),
    muscleGroupId: varchar('muscle_group_id', { length: 50 })
      .references(() => muscleGroups.id, { onDelete: 'restrict' })
      .notNull(),
    equipment: varchar({ length: 50 }),
    isCompound: boolean('is_compound').notNull().default(false),
    isPreset: boolean('is_preset').notNull().default(true),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    force: varchar({ length: 20 }),
    level: varchar({ length: 20 }),
    mechanic: varchar({ length: 20 }),
    category: varchar({ length: 50 }),
    secondaryMuscles: text('secondary_muscles').array(),
  },
  (table) => [
    index('exercises_muscle_group_id_idx').on(table.muscleGroupId),
    index('exercises_created_by_idx').on(table.createdBy),
  ]
);

export const exercisesRelations = relations(exercises, ({ one }) => ({
  muscleGroup: one(muscleGroups, {
    fields: [exercises.muscleGroupId],
    references: [muscleGroups.id],
  }),
  creator: one(users, {
    fields: [exercises.createdBy],
    references: [users.id],
  }),
}));

// ---------------------------------------------------------------------------
// program_templates — preset and custom program definitions
// ---------------------------------------------------------------------------

export const programTemplates = pgTable(
  'program_templates',
  {
    id: varchar({ length: 50 }).primaryKey(),
    name: varchar({ length: 100 }).notNull(),
    description: text().notNull().default(''),
    author: varchar({ length: 100 }).notNull().default(''),
    version: smallint().notNull().default(1),
    category: varchar({ length: 50 }).notNull().default('strength'),
    source: varchar({ length: 10 }).notNull().default('preset'),
    definition: jsonb().notNull(),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('program_templates_is_active_idx').on(table.isActive)]
);
