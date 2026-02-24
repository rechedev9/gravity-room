import type { ProgramDefinition } from '../types/program';
import { PPL531_DAYS } from './ppl531-days/days';

// ---------------------------------------------------------------------------
// PPL 5/3/1 + Double Progression Definition
// ---------------------------------------------------------------------------

/**
 * PPL 5/3/1 + Double Progression by HeXaN.
 *
 * 6-day/week Push/Pull/Legs split combining 5/3/1-style main lifts with
 * double-progression accessories. Main lifts use Training Max (TM) at
 * 75% (work set) and 85% (AMRAP set). TM increases are conditional on
 * hitting >= 5 reps on the AMRAP. Accessories use multi-stage double
 * progression (8-10 or 15-20 rep ranges).
 *
 * Day rotation: Pull A, Push A, Legs A, Pull B, Push B, Legs B.
 * 26 weeks (156 workouts), 6 workouts/week.
 */
export const PPL531_DEFINITION: ProgramDefinition = {
  id: 'ppl531',
  name: 'PPL 5/3/1 + Double Progression',
  description:
    'Programa Push/Pull/Legs de 6 dias por semana combinando la metodologia 5/3/1 ' +
    'para los levantamientos principales con doble progresion para los accesorios. ' +
    'Creado por HeXaN.',
  author: 'HeXaN',
  version: 1,
  category: 'hypertrophy',
  source: 'preset',
  cycleLength: 6,
  totalWorkouts: 156,
  workoutsPerWeek: 6,

  exercises: {
    // Main lifts
    deadlift: { name: 'Peso Muerto' },
    bench: { name: 'Press Banca' },
    squat: { name: 'Sentadilla' },
    pullup: { name: 'Dominadas' },
    ohp: { name: 'Press Militar' },

    // Pull accessories
    lat_pulldown: { name: 'Jalon al Pecho' },
    seated_row: { name: 'Remo Sentado' },
    face_pull: { name: 'Face Pull' },
    hammer_curl: { name: 'Curl Martillo' },
    incline_curl: { name: 'Curl Inclinado' },
    bent_over_row: { name: 'Remo con Barra' },
    incline_row: { name: 'Remo Inclinado' },
    lying_bicep_curl: { name: 'Curl Tumbado' },

    // Push accessories
    incline_db_press: { name: 'Press Inclinado Mancuernas' },
    triceps_pushdown: { name: 'Extension Triceps Polea' },
    triceps_extension: { name: 'Extension Triceps' },
    lateral_raise: { name: 'Elevaciones Laterales' },

    // Leg accessories
    barbell_rdl: { name: 'RDL con Barra' },
    dumbbell_rdl: { name: 'RDL con Mancuernas' },
    bulgarian_split_squat: { name: 'Zancada Bulgara' },
    cable_pull_through: { name: 'Pull Through en Polea' },
    standing_calf_raise: { name: 'Gemelo de Pie' },
    seated_leg_curl: { name: 'Curl Femoral Sentado' },
  },

  configFields: [
    // --- Training Max ---
    {
      key: 'squat_tm',
      label: 'Sentadilla (Training Max)',
      type: 'weight',
      min: 10,
      step: 2.5,
      group: 'Training Max',
    },
    {
      key: 'bench_tm',
      label: 'Press Banca (Training Max)',
      type: 'weight',
      min: 10,
      step: 2.5,
      group: 'Training Max',
    },
    {
      key: 'deadlift_tm',
      label: 'Peso Muerto (Training Max)',
      type: 'weight',
      min: 10,
      step: 2.5,
      group: 'Training Max',
    },
    {
      key: 'ohp_tm',
      label: 'Press Militar (Training Max)',
      type: 'weight',
      min: 10,
      step: 2.5,
      group: 'Training Max',
    },
    {
      key: 'pullup_tm',
      label: 'Dominadas (Training Max)',
      type: 'weight',
      min: 10,
      step: 2.5,
      group: 'Training Max',
    },

    // --- Accesorios Tiron ---
    {
      key: 'lat_pulldown',
      label: 'Jalon al Pecho',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Accesorios Tiron',
    },
    {
      key: 'seated_row',
      label: 'Remo Sentado',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Accesorios Tiron',
    },
    {
      key: 'face_pull',
      label: 'Face Pull',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Accesorios Tiron',
    },
    {
      key: 'hammer_curl_a',
      label: 'Curl Martillo (Pull A)',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Accesorios Tiron',
    },
    {
      key: 'incline_curl',
      label: 'Curl Inclinado',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Accesorios Tiron',
    },
    {
      key: 'bent_over_row',
      label: 'Remo con Barra',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Accesorios Tiron',
    },
    {
      key: 'incline_row',
      label: 'Remo Inclinado',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Accesorios Tiron',
    },
    {
      key: 'hammer_curl_b',
      label: 'Curl Martillo (Pull B)',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Accesorios Tiron',
    },
    {
      key: 'lying_bicep_curl',
      label: 'Curl Tumbado',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Accesorios Tiron',
    },

    // --- Accesorios Empuje ---
    {
      key: 'incline_db_press',
      label: 'Press Inclinado Mancuernas',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Accesorios Empuje',
    },
    {
      key: 'triceps_pushdown',
      label: 'Extension Triceps Polea',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Accesorios Empuje',
    },
    {
      key: 'triceps_extension',
      label: 'Extension Triceps',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Accesorios Empuje',
    },
    {
      key: 'lateral_raise',
      label: 'Elevaciones Laterales',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Accesorios Empuje',
    },

    // --- Accesorios Piernas ---
    {
      key: 'barbell_rdl',
      label: 'RDL con Barra',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Accesorios Piernas',
    },
    {
      key: 'dumbbell_rdl',
      label: 'RDL con Mancuernas',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Accesorios Piernas',
    },
    {
      key: 'bulgarian_split_squat',
      label: 'Zancada Bulgara',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Accesorios Piernas',
    },
    {
      key: 'cable_pull_through',
      label: 'Pull Through en Polea',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Accesorios Piernas',
    },
    {
      key: 'standing_calf_raise',
      label: 'Gemelo de Pie',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Accesorios Piernas',
    },
    {
      key: 'seated_leg_curl',
      label: 'Curl Femoral Sentado',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Accesorios Piernas',
    },
  ],

  weightIncrements: {
    // Accessories that use double progression need their dp increment here.
    // Main lifts use TM (no weight increment needed).
    lat_pulldown: 2.5,
    seated_row: 2.5,
    face_pull: 2.5,
    hammer_curl: 0.5,
    incline_curl: 0.5,
    bent_over_row: 0.5,
    incline_row: 2.5,
    lying_bicep_curl: 0.5,
    incline_db_press: 0.5,
    triceps_pushdown: 2.5,
    triceps_extension: 2.5,
    lateral_raise: 0.5,
    barbell_rdl: 0.5,
    dumbbell_rdl: 0.5,
    bulgarian_split_squat: 0.5,
    cable_pull_through: 2.5,
    standing_calf_raise: 2.5,
    seated_leg_curl: 2.5,
  },

  days: [...PPL531_DAYS],
};
