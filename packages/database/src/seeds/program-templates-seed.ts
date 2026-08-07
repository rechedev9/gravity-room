/**
 * Idempotent seed for the program_templates table.
 * Metadata (name, description, author, category, isActive) comes from
 * @gzclp/domain/catalog — the single source of truth.
 * JSONB definitions are kept here as a DB-layer concern.
 *
 * Safety: before deactivating a template, any active program instances
 * referencing it are auto-completed to prevent orphaned programs.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql, eq, and, inArray } from 'drizzle-orm';
import { programTemplates, programInstances } from '../schema';
import type * as schema from '../schema';
import { PROGRAM_CATALOG } from '@gzclp/domain/catalog';
import { CATALOG_DEFINITION_JSONB_BY_ID } from './catalog-definition-registry';

type DbClient = PostgresJsDatabase<typeof schema>;

export async function seedProgramTemplates(db: DbClient): Promise<void> {
  await db.transaction(async (tx) => {
    const deactivatingIds = PROGRAM_CATALOG.filter((meta) => !meta.isActive).map((meta) => meta.id);

    // A failed catalog upsert must not leave user programs completed against the
    // old catalog state, so both mutations belong to one transaction.
    if (deactivatingIds.length > 0) {
      const completed = await tx
        .update(programInstances)
        .set({ status: 'completed', updatedAt: new Date() })
        .where(
          and(
            eq(programInstances.status, 'active'),
            inArray(programInstances.templateId, deactivatingIds)
          )
        )
        .returning({ id: programInstances.id, templateId: programInstances.templateId });

      if (completed.length > 0) {
        console.error(
          `[seed] Auto-completed ${completed.length} active instance(s) for deactivated templates: ${completed.map((c) => `${c.id} (${c.templateId})`).join(', ')}`
        );
      }
    }

    await tx
      .insert(programTemplates)
      .values(
        PROGRAM_CATALOG.map((meta) => ({
          id: meta.id,
          name: meta.name,
          description: meta.description,
          author: meta.author,
          version: 1,
          category: meta.category,
          level: meta.level,
          source: 'preset',
          definition: CATALOG_DEFINITION_JSONB_BY_ID[meta.id],
          isActive: meta.isActive,
        }))
      )
      .onConflictDoUpdate({
        target: programTemplates.id,
        set: {
          name: sql`excluded.name`,
          description: sql`excluded.description`,
          author: sql`excluded.author`,
          version: sql`excluded.version`,
          category: sql`excluded.category`,
          level: sql`excluded.level`,
          source: sql`excluded.source`,
          definition: sql`excluded.definition`,
          isActive: sql`excluded.is_active`,
        },
      });
  });
}
