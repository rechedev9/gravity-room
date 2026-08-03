// brunetti-365.ts — "365 Programmare l'Ipertrofia" by Amerigo Brunetti
// Book-faithful assembly of phase builders (see brunetti-phases.ts).
//
// Full preset: FZ 24 + T1 24 + PN 52 + JAW 72 + IS 48 = 220 workouts
// EXP (La Sala del Tiempo): T1 + PN + JAW + IS = 196 workouts

import {
  BRUNETTI_EXERCISES,
  buildFaseZero,
  buildFaseT1,
  buildFasePN,
  buildFaseJAW,
  buildFaseIS,
} from './brunetti-phases';

export {
  buildFaseZero,
  buildFaseT1,
  buildFasePN,
  buildFaseJAW,
  buildFaseIS,
  BOOK_JAW_B1,
  BOOK_JAW_B2,
  BOOK_JAW_B3,
  BOOK_T1_BENCH_D1,
  BOOK_T1_DL_D1,
  BOOK_T1_BOX_SQUAT,
  BOOK_PN_SQUAT_D1_MAIN,
  BOOK_PN_BENCH_D1,
  BOOK_PN_DL_D3_B1,
  BOOK_PN_BENCH_D3_B2,
  BOOK_PN_SQUAT_D1_B2,
  BOOK_IS_SQUAT_D1,
  BOOK_IS_BENCH_D1,
  FZ_EXIT_NOTES,
} from './brunetti-phases';

const FZ_DAYS = buildFaseZero();
const T1_DAYS = buildFaseT1();
const PN_DAYS = buildFasePN();
const JAW_DAYS = buildFaseJAW();
const IS_DAYS = buildFaseIS();

const FULL_DAYS = [...FZ_DAYS, ...T1_DAYS, ...PN_DAYS, ...JAW_DAYS, ...IS_DAYS];
const EXP_DAYS = [...T1_DAYS, ...PN_DAYS, ...JAW_DAYS, ...IS_DAYS];

export const BRUNETTI365_DEFINITION_JSONB = {
  configTitle: "365 Programmare l'Ipertrofia",
  configDescription:
    'Programa anual de hipertrofia de Amerigo Brunetti (2018), alineado al manual: ' +
    'Fase Zero Incipit (8 sem × 3 dias), T1 Perfezionamento (6×4), PN2 (13×4), ' +
    'JAW (18×4, escalera solo en squat/panca), IS Soluzione A (12×4, 2 sottofasi). ' +
    'Tras cada test de maximo JAW actualiza el TM del bloque siguiente (squat/panca).',
  configEditTitle: 'Editar Pesos y Training Max',
  configEditDescription:
    'Actualiza tus Training Max o pesos iniciales. ' +
    'Durante la fase JAW, actualiza los TM de squat/panca del bloque correspondiente ' +
    'despues de cada test de maximo.',
  cycleLength: FULL_DAYS.length,
  totalWorkouts: FULL_DAYS.length,
  workoutsPerWeek: 4,
  exercises: BRUNETTI_EXERCISES,
  configFields: [
    {
      key: 'squat_tm',
      label: 'Sentadilla (Training Max)',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'Training Max',
      hint: '~90% de tu 1RM con buena tecnica. Se usa en T1, PN, JAW (stacco) e IS.',
    },
    {
      key: 'bench_tm',
      label: 'Press Banca (Training Max)',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'Training Max',
      hint: '~90% de tu 1RM con buena tecnica. Se usa en T1, PN e IS.',
    },
    {
      key: 'deadlift_tm',
      label: 'Peso Muerto (Training Max)',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'Training Max',
      hint: '1RM de referencia para stacco (no usa escalera JAW).',
    },
    {
      key: 'squat_jaw_b1_tm',
      label: 'Sentadilla — TM Bloque 1',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'JAW Bloque 1 — TM',
      hint: 'TM para la escalera JAW de squat en el Bloque 1.',
      groupHint:
        'Sem. 1-5: JAW squat/panca · Sem. 6: test de maximo. Tras el test, actualiza TM Bloque 2 (squat/panca).',
    },
    {
      key: 'bench_jaw_b1_tm',
      label: 'Press Banca — TM Bloque 1',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'JAW Bloque 1 — TM',
      hint: 'TM para la escalera JAW de panca en el Bloque 1.',
    },
    {
      key: 'squat_jaw_b2_tm',
      label: 'Sentadilla — TM Bloque 2',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'JAW Bloque 2 — TM',
      hint: 'Actualiza con el maximo del test del Bloque 1.',
      groupHint: 'Sem. 7-11: JAW · Sem. 12: test. Actualiza TM Bloque 3.',
    },
    {
      key: 'bench_jaw_b2_tm',
      label: 'Press Banca — TM Bloque 2',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'JAW Bloque 2 — TM',
      hint: 'Actualiza con el maximo del test del Bloque 1.',
    },
    {
      key: 'squat_jaw_b3_tm',
      label: 'Sentadilla — TM Bloque 3',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'JAW Bloque 3 — TM',
      hint: 'Actualiza con el maximo del test del Bloque 2.',
      groupHint: 'Sem. 13-17: JAW · Sem. 18: test final. No hay bloque siguiente.',
    },
    {
      key: 'bench_jaw_b3_tm',
      label: 'Press Banca — TM Bloque 3',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'JAW Bloque 3 — TM',
      hint: 'Actualiza con el maximo del test del Bloque 2.',
    },
    {
      key: 'fz_squat_start',
      label: 'Sentadilla (peso Fase Zero)',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Pesos Iniciales — Fase Zero',
      hint: 'Opcional: barra o carga ligera a partir de la semana 5 del Incipit.',
    },
    {
      key: 'fz_bench_start',
      label: 'Press Banca (peso Fase Zero)',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Pesos Iniciales — Fase Zero',
    },
    {
      key: 'fz_deadlift_start',
      label: 'Peso Muerto (peso Fase Zero)',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Pesos Iniciales — Fase Zero',
    },
    {
      key: 'acc_incline_db_press',
      label: 'Press Inclinado Mancuernas',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Accesorios',
    },
    {
      key: 'acc_seal_row',
      label: 'Seal Row',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Accesorios',
    },
    {
      key: 'acc_one_arm_row',
      label: 'Remo Unilateral',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Accesorios',
    },
    {
      key: 'acc_general',
      label: 'Accesorios generales (carga libre)',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Accesorios',
    },
  ],
  weightIncrements: {},
  days: FULL_DAYS,
};

const SHARED_CONFIG_FIELDS = BRUNETTI365_DEFINITION_JSONB.configFields.filter(
  (f) => f.group !== 'Pesos Iniciales — Fase Zero'
);

export const BRUNETTI365_EXP_DEFINITION_JSONB = {
  configTitle: 'La Sala del Tiempo',
  configDescription:
    'Metodologia Brunetti sin Fase Zero: T1 + PN2 + JAW + IS (196 sesiones). ' +
    'Para atletas que ya dominan squat, panca y stacco. ' +
    'JAW: 3 bloques con test de maximo de squat/panca al final de cada uno.',
  configEditTitle: BRUNETTI365_DEFINITION_JSONB.configEditTitle,
  configEditDescription:
    'Actualiza tus Training Max. Durante JAW, actualiza squat/panca del bloque ' +
    'siguiente tras cada test de maximo.',
  cycleLength: EXP_DAYS.length,
  totalWorkouts: EXP_DAYS.length,
  workoutsPerWeek: 4,
  exercises: BRUNETTI_EXERCISES,
  configFields: SHARED_CONFIG_FIELDS,
  weightIncrements: {},
  days: EXP_DAYS,
};
