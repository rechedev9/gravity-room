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
          'Como entrenar en el planeta de Kaio-sama: progresi\u00f3n lineal bajo presi\u00f3n constante. ' +
          'Rotaci\u00f3n de 4 d\u00edas con ejercicios T1, T2 y T3. Si fallas, cambias de etapa y ' +
          'sigues luchando. Inspirado en el m\u00e9todo GZCL de Cody LeFever.',
        author: 'Gravity Room',
        version: 1,
        category: 'strength',
        source: 'preset',
        definition: GZCLP_DEFINITION_JSONB,
        isActive: true,
      },
      {
        id: 'ppl531',
        name: 'PPL 5/3/1',
        description:
          'Seis d\u00edas de Kaioken: empuja tu cuerpo al m\u00e1ximo con fuerza y volumen. ' +
          'Push/Pull/Legs combinando 5/3/1 para los compuestos principales con doble ' +
          'progresi\u00f3n en accesorios. Inspirado en la metodolog\u00eda de HeXaN.',
        author: 'Gravity Room',
        version: 1,
        category: 'hypertrophy',
        source: 'preset',
        definition: PPL531_DEFINITION_JSONB,
        isActive: true,
      },
      {
        id: 'stronglifts5x5',
        name: 'Torre de Karin',
        description:
          'El rito de paso de todo guerrero: sentadilla cada sesi\u00f3n, subiendo peso ' +
          'escal\u00f3n a escal\u00f3n como quien sube la Torre de Karin. ' +
          'Dos entrenamientos alternos (A/B), 3 d\u00edas por semana. +2.5 kg por sesi\u00f3n. ' +
          'Tres fallos provocan descarga del 10%. Inspirado en StrongLifts 5x5.',
        author: 'Gravity Room',
        version: 1,
        category: 'strength',
        source: 'preset',
        definition: STRONGLIFTS_DEFINITION_JSONB,
        isActive: true,
      },
      {
        id: 'phraks-gslp',
        name: 'El Zenkai',
        description:
          'Como un Saiyan: empuja hasta el fallo t\u00e9cnico (AMRAP), descarga un 10% ' +
          'y vuelve m\u00e1s fuerte. Dos entrenamientos alternos (A/B), 3 d\u00edas por semana. ' +
          'Cada serie final es al m\u00e1ximo. Inspirado en Greyskull LP de Phrakture.',
        author: 'Gravity Room',
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
          'El secreto de la fuerza seg\u00fan el Maestro Roshi: repeticiones aburridas pero ' +
          'enormes resultados. Ciclos de 4 semanas (5s, 3s, 5/3/1, descarga) con 5\u00d710 ' +
          'de volumen suplementario. 4 d\u00edas por semana. Inspirado en 5/3/1 BBB de Jim Wendler.',
        author: 'Gravity Room',
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
          'Entrenamiento de cuerpo completo en el Palacio Celeste: 3 d\u00edas por semana, ' +
          'dos levantamientos principales por sesi\u00f3n. Ciclos de 3 semanas (5s, 3s, 5/3/1) ' +
          'con FSL 5\u00d75 como suplemento. Met\u00f3dico y equilibrado. ' +
          'Inspirado en 5/3/1 for Beginners de Jim Wendler.',
        author: 'Gravity Room',
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
          'Fuerza y tama\u00f1o como Vegeta en su c\u00e1mara de gravedad: dos d\u00edas de poder puro ' +
          '(compuestos pesados 3-5 reps) y dos de hipertrofia (8-12 reps). ' +
          '4 d\u00edas por semana. Inspirado en PHUL de Brandon Campbell.',
        author: 'Gravity Room',
        version: 1,
        category: 'hypertrophy',
        source: 'preset',
        definition: PHUL_DEFINITION_JSONB,
        isActive: true,
      },
      {
        id: 'nivel7',
        name: 'Super Saiyan',
        description:
          '12 semanas hasta la transformaci\u00f3n: configuras tu r\u00e9cord objetivo y los pesos ' +
          'se calculan hacia atr\u00e1s hasta el momento de alcanzarlo. Bloque 1 (5\u00d75) acumula energ\u00eda, ' +
          'Bloque 2 (3\u00d73) culmina en tu nuevo m\u00e1ximo. ' +
          '4 d\u00edas/semana. Inspirado en Nivel 7 de musclecoop.',
        author: 'Gravity Room',
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
          'y poco a poco a\u00f1ade la barra. 200 sesiones, 3 d\u00edas/semana. ' +
          '4 bloques por sesi\u00f3n: Core, Activaci\u00f3n, Propiocepci\u00f3n y el Ejercicio Fundamental. ' +
          'Inspirado en la metodolog\u00eda de Amerigo Brunetti.',
        author: 'Gravity Room',
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
        name: 'Tenkaichi Budokai \u2014 Sentadilla',
        description:
          'Preparaci\u00f3n de 16 semanas para el torneo con \u00e9nfasis en sentadilla. ' +
          'Porcentajes exactos de tu 1RM, periodizaci\u00f3n por mesociclos, deload antes de competir. ' +
          '4 d\u00edas por semana. Inspirado en la metodolog\u00eda de Boris Sheiko.',
        author: 'Gravity Room',
        version: 1,
        category: 'powerlifting',
        source: 'preset',
        definition: SHEIKO_7_1_DEFINITION,
        isActive: true,
      },
      {
        id: 'sheiko-7-2',
        name: 'Tenkaichi Budokai \u2014 Press Banca',
        description:
          'Preparaci\u00f3n de 16 semanas para el torneo con \u00e9nfasis en press banca. ' +
          'Porcentajes exactos de tu 1RM, m\u00faltiples variaciones de banca. ' +
          '4 d\u00edas por semana. Inspirado en la metodolog\u00eda de Boris Sheiko.',
        author: 'Gravity Room',
        version: 1,
        category: 'powerlifting',
        source: 'preset',
        definition: SHEIKO_7_2_DEFINITION,
        isActive: true,
      },
      {
        id: 'sheiko-7-3',
        name: 'Tenkaichi Budokai \u2014 Peso Muerto',
        description:
          'Preparaci\u00f3n de 16 semanas para el torneo con \u00e9nfasis en peso muerto. ' +
          'D\u00e9ficit, bloques, cadenas, bandas \u2014 todas las variaciones de peso muerto. ' +
          '4 d\u00edas por semana. Inspirado en la metodolog\u00eda de Boris Sheiko.',
        author: 'Gravity Room',
        version: 1,
        category: 'powerlifting',
        source: 'preset',
        definition: SHEIKO_7_3_DEFINITION,
        isActive: true,
      },
      {
        id: 'sheiko-7-4',
        name: 'Tenkaichi Budokai \u2014 Solo Banca',
        description:
          'Preparaci\u00f3n de 18 semanas exclusiva para press banca. ' +
          'Sin sentadilla ni peso muerto de competici\u00f3n \u2014 toda la energ\u00eda en un solo golpe. ' +
          '4 d\u00edas por semana. Inspirado en la metodolog\u00eda de Boris Sheiko.',
        author: 'Gravity Room',
        version: 1,
        category: 'powerlifting',
        source: 'preset',
        definition: SHEIKO_7_4_DEFINITION,
        isActive: true,
      },
      {
        id: 'sheiko-7-5',
        name: 'Tenkaichi Budokai \u2014 Veterano',
        description:
          'El programa m\u00e1s popular de Sheiko para guerreros experimentados. ' +
          '4 mesociclos de preparaci\u00f3n con volumen medio y test de 1RM integrado. ' +
          'Usa tu experiencia de combate para llegar al torneo en tu mejor forma. ' +
          '4 d\u00edas por semana. Inspirado en la metodolog\u00eda de Boris Sheiko.',
        author: 'Gravity Room',
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
