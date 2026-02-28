/**
 * Idempotent seed for the program_templates table.
 * Inserts 8 preset programs with their full JSONB definitions.
 * Exercise names are omitted from JSONB — they are resolved from the exercises table at hydration time.
 * Uses onConflictDoNothing() to allow re-runs without error.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { programTemplates } from '../schema';
import type * as schema from '../schema';
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

type DbClient = PostgresJsDatabase<typeof schema>;

export async function seedProgramTemplates(db: DbClient): Promise<void> {
  await db
    .insert(programTemplates)
    .values([
      {
        id: 'gzclp',
        name: 'GZCLP',
        description:
          'Un programa de progresión lineal basado en el método GZCL. ' +
          'Rotación de 4 días con ejercicios T1, T2 y T3 para desarrollar fuerza en los levantamientos compuestos principales. ' +
          'Comunidad en r/gzcl.',
        author: 'Cody LeFever',
        version: 1,
        category: 'strength',
        source: 'preset',
        definition: GZCLP_DEFINITION_JSONB,
        isActive: true,
      },
      {
        id: 'ppl531',
        name: 'PPL 5/3/1 + Double Progression',
        description:
          'Programa Push/Pull/Legs de 6 días por semana combinando la metodología 5/3/1 ' +
          'para los levantamientos principales con doble progresión para los accesorios. ' +
          'Creado por HeXaN.',
        author: 'HeXaN',
        version: 1,
        category: 'hypertrophy',
        source: 'preset',
        definition: PPL531_DEFINITION_JSONB,
        isActive: true,
      },
      {
        id: 'stronglifts5x5',
        name: 'StrongLifts 5x5',
        description:
          'Programa clásico de fuerza para principiantes. ' +
          'Dos entrenamientos alternos (A/B), 3 días por semana. ' +
          'Sentadilla en cada sesión, progresión lineal de +2.5 kg por entrenamiento (+5 kg en peso muerto). ' +
          'Tres fallos consecutivos provocan una descarga del 10%.',
        author: 'Mehdi Hadim',
        version: 1,
        category: 'strength',
        source: 'preset',
        definition: STRONGLIFTS_DEFINITION_JSONB,
        isActive: true,
      },
      {
        id: 'phraks-gslp',
        name: "Phrak's Greyskull LP",
        description:
          'Programa de fuerza para principiantes de Phrakture. ' +
          'Dos entrenamientos alternos (A/B), 3 días por semana. ' +
          'Cada ejercicio termina con una serie AMRAP (al fallo técnico). ' +
          'Progresión lineal con descarga del 10% al fallar.',
        author: 'Phrakture (r/Fitness)',
        version: 1,
        category: 'strength',
        source: 'preset',
        definition: GSLP_DEFINITION_JSONB,
        isActive: true,
      },
      {
        id: 'wendler531bbb',
        name: '5/3/1 Boring But Big',
        description:
          'Plantilla clásica de 5/3/1 con suplemento Boring But Big (5×10 al 50% del TM). ' +
          'Ciclos de 4 semanas: 5s, 3s, 5/3/1 y descarga. ' +
          '4 días por semana con progresión del Training Max tras cada ciclo.',
        author: 'Jim Wendler',
        version: 1,
        category: 'strength',
        source: 'preset',
        definition: BBB_DEFINITION_JSONB,
        isActive: true,
      },
      {
        id: 'wendler531beginners',
        name: '5/3/1 for Beginners',
        description:
          'Programa de fuerza para principiantes de Jim Wendler. ' +
          'Cuerpo completo 3 días por semana con dos levantamientos principales por sesión. ' +
          'Ciclos de 3 semanas (5s, 3s, 5/3/1) con FSL (First Set Last) 5×5 como suplemento. ' +
          'Progresión del Training Max tras cada ciclo.',
        author: 'Jim Wendler',
        version: 1,
        category: 'strength',
        source: 'preset',
        definition: FSL531_DEFINITION_JSONB,
        isActive: true,
      },
      {
        id: 'phul',
        name: 'PHUL',
        description:
          'Power Hypertrophy Upper Lower — programa de 4 días que combina fuerza e hipertrofia. ' +
          'Dos días de fuerza (compuestos pesados 3-5 reps) y dos de hipertrofia (8-12 reps). ' +
          'Los compuestos principales progresan linealmente, los accesorios con doble progresión.',
        author: 'Brandon Campbell',
        version: 1,
        category: 'hypertrophy',
        source: 'preset',
        definition: PHUL_DEFINITION_JSONB,
        isActive: true,
      },
      {
        id: 'nivel7',
        name: 'Nivel 7',
        description:
          'Programa de fuerza de 12 semanas con periodización inversa. ' +
          'Configuras el récord objetivo (semana 6) y los pesos se calculan hacia atrás. ' +
          'Bloque 1 (5×5) con descarga en semana 3, Bloque 2 (3×3) culminando en récord. ' +
          'Ciclo 2 repite la onda con +2.5kg. Accesorios con doble progresión 3×8-12. ' +
          '4 días/semana: hombros/tríceps, espalda/gemelo, pecho/bíceps, pierna.',
        author: 'nivel7 (musclecoop)',
        version: 1,
        category: 'strength',
        source: 'preset',
        definition: NIVEL7_DEFINITION_JSONB,
        isActive: true,
      },
      {
        id: 'mutenroshi',
        name: 'Caparaz\u00f3n de Tortuga',
        description:
          'Tu entrenamiento en la Kame House: empieza desde cero con tu peso corporal ' +
          'y poco a poco a\u00f1ade la barra. Programa de Amerigo Brunetti (365). ' +
          '200 sesiones, 3 d\u00edas/semana. 4 bloques por sesi\u00f3n: Core, Activaci\u00f3n, ' +
          'Propiocepci\u00f3n y el Ejercicio Fundamental.',
        author: 'Amerigo Brunetti',
        version: 1,
        category: 'beginner',
        source: 'preset',
        definition: MUTENROSHI_DEFINITION_JSONB,
        isActive: true,
      },
      {
        id: 'brunetti-365',
        name: "365 Programmare l'Ipertrofia",
        description:
          'Programa anual de hipertrofia de Amerigo Brunetti estructurado en 5 fases y 212 sesiones. ' +
          'Fase Zero (8 semanas): técnica con cargas mínimas. ' +
          'Fase T1 (6 semanas): introducción de carga en los tres levantamientos fundamentales. ' +
          'Fase PN (13 semanas): ramping progresivo con sobrecargas específicas. ' +
          'Fase JAW (18 semanas): 3 bloques independientes de intensificación con TM propios y test de 1RM al final de cada bloque. ' +
          'Fase IS (12 semanas): trabajo de aislamiento y consolidación, 12–30 repeticiones. ' +
          '4 días por semana.',
        author: 'Amerigo Brunetti',
        version: 1,
        category: 'hypertrophy',
        source: 'preset',
        definition: BRUNETTI365_DEFINITION_JSONB,
        isActive: false,
      },
      {
        id: 'brunetti-365-exp',
        name: 'La Sala del Tiempo',
        description:
          'Inspirado en la metodolog\u00eda de Amerigo Brunetti. Tu a\u00f1o en la Sala del Tiempo: ' +
          '196 sesiones de hipertrofia estructurada en 4 fases de intensidad creciente ' +
          '(T1, PN, JAW, IS). Solo para guerreros que ya dominan sentadilla, press banca ' +
          'y peso muerto. 4 d\u00edas por semana.',
        author: 'Gravity Room',
        version: 1,
        category: 'hypertrophy',
        source: 'preset',
        definition: BRUNETTI365_EXP_DEFINITION_JSONB,
        isActive: true,
      },
      {
        id: 'sheiko-7-1',
        name: 'Sheiko 7.1 — Sentadilla',
        description:
          'Programa Sheiko de 16 semanas con enfasis en sentadilla. ' +
          'Tres levantamientos de competicion con mayor volumen de sentadilla. ' +
          '4 entrenamientos por semana. Basado en el libro "Powerlifting: Foundations and Methods".',
        author: 'Boris Sheiko',
        version: 1,
        category: 'powerlifting',
        source: 'preset',
        definition: SHEIKO_7_1_DEFINITION,
        isActive: true,
      },
      {
        id: 'sheiko-7-2',
        name: 'Sheiko 7.2 — Press Banca',
        description:
          'Programa Sheiko de 16 semanas con enfasis en press banca. ' +
          'Tres levantamientos de competicion con mayor volumen de press banca. ' +
          '4 entrenamientos por semana. Basado en el libro "Powerlifting: Foundations and Methods".',
        author: 'Boris Sheiko',
        version: 1,
        category: 'powerlifting',
        source: 'preset',
        definition: SHEIKO_7_2_DEFINITION,
        isActive: true,
      },
      {
        id: 'sheiko-7-3',
        name: 'Sheiko 7.3 — Peso Muerto',
        description:
          'Programa Sheiko de 16 semanas con enfasis en peso muerto. ' +
          'Tres levantamientos de competicion con mayor volumen de peso muerto y variaciones. ' +
          '4 entrenamientos por semana. Basado en el libro "Powerlifting: Foundations and Methods".',
        author: 'Boris Sheiko',
        version: 1,
        category: 'powerlifting',
        source: 'preset',
        definition: SHEIKO_7_3_DEFINITION,
        isActive: true,
      },
      {
        id: 'sheiko-7-4',
        name: 'Sheiko 7.4 — Solo Press Banca',
        description:
          'Programa Sheiko de 18 semanas exclusivo para press banca. ' +
          'Sin sentadilla ni peso muerto de competicion. ' +
          '4 entrenamientos por semana. Basado en el libro "Powerlifting: Foundations and Methods".',
        author: 'Boris Sheiko',
        version: 1,
        category: 'powerlifting',
        source: 'preset',
        definition: SHEIKO_7_4_DEFINITION,
        isActive: true,
      },
      {
        id: 'sheiko-7-5',
        name: 'Sheiko 7.5 — Volumen Medio (Experto)',
        description:
          'Programa Sheiko de ~16 semanas (4 mesociclos) con volumen medio para atletas experimentados. ' +
          'Periodizacion por mesociclos con test de 1RM integrado. ' +
          '4 entrenamientos por semana. Basado en el libro "Powerlifting: Foundations and Methods".',
        author: 'Boris Sheiko',
        version: 1,
        category: 'powerlifting',
        source: 'preset',
        definition: SHEIKO_7_5_DEFINITION,
        isActive: true,
      },
    ])
    .onConflictDoUpdate({
      target: programTemplates.id,
      set: {
        description: sql`excluded.description`,
        author: sql`excluded.author`,
        definition: sql`excluded.definition`,
      },
    });
}
