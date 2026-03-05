/**
 * Idempotent seed for the program_templates table.
 * Metadata (name, description, author, category, isActive) comes from
 * @gzclp/shared/catalog — the single source of truth.
 * JSONB definitions are kept here as a DB-layer concern.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { programTemplates } from '../schema';
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

type DbClient = PostgresJsDatabase<typeof schema>;

const DEFINITION_MAP: Record<string, unknown> = {
  gzclp: GZCLP_DEFINITION_JSONB,
  ppl531: PPL531_DEFINITION_JSONB,
  stronglifts5x5: STRONGLIFTS_DEFINITION_JSONB,
  'phraks-gslp': GSLP_DEFINITION_JSONB,
  wendler531bbb: BBB_DEFINITION_JSONB,
  wendler531beginners: FSL531_DEFINITION_JSONB,
  phul: PHUL_DEFINITION_JSONB,
  nivel7: NIVEL7_DEFINITION_JSONB,
  mutenroshi: MUTENROSHI_DEFINITION_JSONB,
  'brunetti-365': BRUNETTI365_DEFINITION_JSONB,
  'brunetti-365-exp': BRUNETTI365_EXP_DEFINITION_JSONB,
  'sheiko-7-1': SHEIKO_7_1_DEFINITION,
  'sheiko-7-2': SHEIKO_7_2_DEFINITION,
  'sheiko-7-3': SHEIKO_7_3_DEFINITION,
  'sheiko-7-4': SHEIKO_7_4_DEFINITION,
  'sheiko-7-5': SHEIKO_7_5_DEFINITION,
  'sala-del-tiempo-1': SALA_1_DEFINITION_JSONB,
  'sala-del-tiempo-2': SALA_2_DEFINITION_JSONB,
  'sala-del-tiempo-3': SALA_3_DEFINITION_JSONB,
};

export async function seedProgramTemplates(db: DbClient): Promise<void> {
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
        source: sql`excluded.source`,
        definition: sql`excluded.definition`,
        isActive: sql`excluded.is_active`,
      },
    });
}
