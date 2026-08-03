// sala-2.ts — "La Sala del Tiempo 2" (Fase Due: Potenziamento Neurale PN2)
// Book-faithful PN2 shared with brunetti-365 (OCR p.72–77).

import { buildFasePN, BRUNETTI_EXERCISES } from './brunetti-phases';

const PN_DAYS = buildFasePN();

export const SALA_2_DEFINITION_JSONB = {
  configTitle: 'La Sala del Tiempo 2 — Potenziamento Neurale',
  configDescription:
    'Fase PN2 del manual Brunetti: 13 semanas × 4 dias. ' +
    'Blocco 1 (sem 1–5) + Blocco 2 (sem 6–13) con tablas de squat/panca/stacco del libro. ' +
    'Semana 13: test de maximo squat-panca-stacco.',
  configEditTitle: 'Editar Training Max',
  configEditDescription: 'Actualiza tu Training Max (~90% 1RM). Deberias haber completado T1.',
  cycleLength: PN_DAYS.length,
  totalWorkouts: PN_DAYS.length,
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
      label: 'Accesorios generales',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Accesorios',
    },
  ],
  weightIncrements: {},
  days: PN_DAYS,
};
