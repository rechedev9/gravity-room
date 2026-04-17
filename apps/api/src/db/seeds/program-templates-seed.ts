/**
 * Idempotent seed for the program_templates table.
 * Metadata (name, description, author, category, isActive) comes from
 * @gzclp/shared/catalog — the single source of truth.
 * JSONB definitions are kept here as a DB-layer concern.
 *
 * Safety: before deactivating a template, any active program instances
 * referencing it are auto-completed to prevent orphaned programs.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql, eq, and, inArray } from 'drizzle-orm';
import { programTemplates, programInstances } from '../schema';
import type * as schema from '../schema';
import { PROGRAM_CATALOG } from '@gzclp/shared/catalog';
import { GZCLP_DEFINITION_JSONB } from './programs/gzclp';
import { PPL531_DEFINITION_JSONB } from './programs/ppl531';
import { STRONGLIFTS_DEFINITION_JSONB } from './programs/stronglifts';
import { GSLP_DEFINITION_JSONB } from './programs/greyskull';
import { BBB_DEFINITION_JSONB } from './programs/bbb';
import { FSL531_DEFINITION_JSONB } from './programs/fsl531';
import { PHUL_DEFINITION_JSONB } from './programs/phul';
import { NIVEL7_DEFINITION_JSONB } from './programs/nivel7';
import { MUTENROSHI_DEFINITION_JSONB } from './programs/mutenroshi';
import {
  BRUNETTI365_DEFINITION_JSONB,
  BRUNETTI365_EXP_DEFINITION_JSONB,
} from './programs/brunetti-365';
import { SHEIKO_7_1_DEFINITION } from './programs/sheiko-7-1';
import { SHEIKO_7_2_DEFINITION } from './programs/sheiko-7-2';
import { SHEIKO_7_3_DEFINITION } from './programs/sheiko-7-3';
import { SHEIKO_7_4_DEFINITION } from './programs/sheiko-7-4';
import { SHEIKO_7_5_DEFINITION } from './programs/sheiko-7-5';
import { SALA_1_DEFINITION_JSONB } from './programs/sala-1';
import { SALA_2_DEFINITION_JSONB } from './programs/sala-2';
import { SALA_3_DEFINITION_JSONB } from './programs/sala-3';
import { PPL_AB_DEFINITION_JSONB } from './programs/ppl-ab';

type DbClient = PostgresJsDatabase<typeof schema>;

const DEFINITION_MAP: Record<string, unknown> = {
  gzclp: GZCLP_DEFINITION_JSONB,
  'hexan-ppl': PPL531_DEFINITION_JSONB,
  'stronglifts-5x5': STRONGLIFTS_DEFINITION_JSONB,
  'phraks-greyskull-lp': GSLP_DEFINITION_JSONB,
  '531-boring-but-big': BBB_DEFINITION_JSONB,
  '531-for-beginners': FSL531_DEFINITION_JSONB,
  phul: PHUL_DEFINITION_JSONB,
  'nivel-7': NIVEL7_DEFINITION_JSONB,
  'caparazon-de-tortuga': MUTENROSHI_DEFINITION_JSONB,
  '365-programmare-lipertrofia': BRUNETTI365_DEFINITION_JSONB,
  'la-sala-del-tiempo': BRUNETTI365_EXP_DEFINITION_JSONB,
  'tenkaichi-budokai-sentadilla': SHEIKO_7_1_DEFINITION,
  'tenkaichi-budokai-press-banca': SHEIKO_7_2_DEFINITION,
  'tenkaichi-budokai-peso-muerto': SHEIKO_7_3_DEFINITION,
  'tenkaichi-budokai-solo-banca': SHEIKO_7_4_DEFINITION,
  'tenkaichi-budokai-veterano': SHEIKO_7_5_DEFINITION,
  'sala-del-tiempo-1': SALA_1_DEFINITION_JSONB,
  'sala-del-tiempo-2': SALA_2_DEFINITION_JSONB,
  'sala-del-tiempo-3': SALA_3_DEFINITION_JSONB,
  'furia-oscura': PPL_AB_DEFINITION_JSONB,
};

export async function seedProgramTemplates(db: DbClient): Promise<void> {
  // Collect template IDs that are being deactivated
  const deactivatingIds = PROGRAM_CATALOG.filter((meta) => !meta.isActive).map((meta) => meta.id);

  // Auto-complete any active instances for templates being deactivated
  if (deactivatingIds.length > 0) {
    const completed = await db
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

  await db
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
        definition: DEFINITION_MAP[meta.id],
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
}
