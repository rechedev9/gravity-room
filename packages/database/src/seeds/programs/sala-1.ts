// sala-1.ts — "La Sala del Tiempo 1" (Fase Uno: Perfezionamento Tecnico)
// Book-faithful T1 shared with brunetti-365 (PROGRAMMA T1, OCR p.43–45).

import { buildFaseT1, BRUNETTI_EXERCISES } from './brunetti-phases';

const T1_DAYS = buildFaseT1();

export const SALA_1_DEFINITION_JSONB = {
  configTitle: 'La Sala del Tiempo 1 — Perfezionamento Tecnico',
  configDescription:
    'Fase T1 del manual Brunetti: 6 semanas × 4 dias. ' +
    'Tempo lento, fermo, box squat, ramping RPE en panca/stacco. ' +
    'Tablas del libro (40–60% 4×10 serie squat; panca 50–55% 8–10×6s; stacco 55–65%).',
  configEditTitle: 'Editar Training Max',
  configEditDescription: 'Actualiza tu Training Max (~90% 1RM) de squat, panca y stacco.',
  cycleLength: T1_DAYS.length,
  totalWorkouts: T1_DAYS.length,
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
    },
    {
      key: 'bench_tm',
      label: 'Press Banca (Training Max)',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'Training Max',
    },
    {
      key: 'deadlift_tm',
      label: 'Peso Muerto (Training Max)',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'Training Max',
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
      key: 'acc_one_arm_row',
      label: 'Remo Unilateral',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Accesorios',
    },
    {
      key: 'acc_general',
      label: 'Accesorios generales',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Accesorios',
    },
    {
      key: 'fz_squat_start',
      label: 'Carga libre (zancadas / variantes)',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Accesorios',
    },
  ],
  weightIncrements: {},
  days: T1_DAYS,
};
