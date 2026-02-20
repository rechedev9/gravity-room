import type { ProgramDefinition } from '../types/program';

// ---------------------------------------------------------------------------
// Helpers to reduce repetition
// ---------------------------------------------------------------------------

type Tier = 't1' | 't2' | 't3';
type ProgressionRule = ProgramDefinition['days'][number]['slots'][number]['onSuccess'];

const NO_CHANGE: ProgressionRule = { type: 'no_change' };
const ADD_WEIGHT: ProgressionRule = { type: 'add_weight' };

interface MainLiftOpts {
  readonly exerciseId: string;
  readonly block: 1 | 2;
  readonly sets: number;
  readonly reps: number;
  readonly isDeadlift?: boolean;
}

function mainLift({ exerciseId, block, sets, reps, isDeadlift }: MainLiftOpts): {
  id: string;
  exerciseId: string;
  tier: Tier;
  stages: [{ sets: number; reps: number }];
  onSuccess: ProgressionRule;
  onUndefined: ProgressionRule;
  onMidStageFail: ProgressionRule;
  onFinalStageFail: ProgressionRule;
  startWeightKey: string;
} {
  return {
    id: `${exerciseId}-b${block}`,
    exerciseId,
    tier: isDeadlift ? 't2' : 't1',
    stages: [{ sets, reps }],
    onSuccess: ADD_WEIGHT,
    onUndefined: ADD_WEIGHT,
    onMidStageFail: NO_CHANGE,
    onFinalStageFail: NO_CHANGE,
    startWeightKey: `${exerciseId}_b${block}`,
  };
}

function acc(
  exerciseId: string,
  tier: Tier,
  sets: number,
  reps: number
): {
  id: string;
  exerciseId: string;
  tier: Tier;
  stages: [{ sets: number; reps: number }];
  onSuccess: ProgressionRule;
  onMidStageFail: ProgressionRule;
  onFinalStageFail: ProgressionRule;
  startWeightKey: string;
} {
  return {
    id: exerciseId,
    exerciseId,
    tier,
    stages: [{ sets, reps }],
    onSuccess: NO_CHANGE,
    onMidStageFail: NO_CHANGE,
    onFinalStageFail: NO_CHANGE,
    startWeightKey: exerciseId,
  };
}

// ---------------------------------------------------------------------------
// Nivel 7 Definition
// ---------------------------------------------------------------------------

/**
 * Nivel 7 — 6-week strength program by "nivel7" (musclecoop forum).
 *
 * Two 3-week blocks: Block 1 = 5×5, Block 2 = 3×3.
 * 4 days/week: Lunes (Hombros/Tríceps), Martes (Espalda/Gemelo),
 *              Jueves (Pecho/Bíceps), Viernes (Pierna).
 *
 * Main lifts auto-progress +2.5kg per session within each block.
 * Accessories have no auto-progression (user adjusts manually).
 */
export const NIVEL7_DEFINITION: ProgramDefinition = {
  id: 'nivel7',
  name: 'Nivel 7',
  description:
    'A 6-week strength program with two 3-week blocks. ' +
    'Block 1 (5×5) and Block 2 (3×3) on 4 main compound lifts with wave loading. ' +
    '4 days per week targeting shoulders/triceps, back/calves, chest/biceps, and legs.',
  author: 'nivel7 (musclecoop)',
  version: 1,
  category: 'strength',
  source: 'preset',
  cycleLength: 24,
  totalWorkouts: 24,
  workoutsPerWeek: 4,
  exercises: {
    press_mil: { name: 'Press Militar' },
    bench: { name: 'Press Banca' },
    squat: { name: 'Sentadilla' },
    deadlift: { name: 'Peso Muerto' },
    press_franc: { name: 'Press Francés' },
    ext_polea: { name: 'Extensión Polea' },
    elev_lat: { name: 'Elevaciones Laterales' },
    elev_post: { name: 'Elevaciones Posteriores' },
    remo_bar: { name: 'Remo con Barra' },
    jalon: { name: 'Jalón al Pecho' },
    face_pull: { name: 'Face Pull' },
    gemelo_pie: { name: 'Gemelo de Pie' },
    gemelo_sent: { name: 'Gemelo Sentado' },
    apert: { name: 'Aperturas' },
    cruces: { name: 'Cruces en Polea' },
    curl_bar: { name: 'Curl con Barra' },
    curl_alt: { name: 'Curl Alterno' },
    curl_mart: { name: 'Curl Martillo' },
    prensa: { name: 'Prensa' },
    ext_quad: { name: 'Extensión Cuádriceps' },
    curl_fem: { name: 'Curl Femoral' },
    hip_thrust: { name: 'Hip Thrust' },
    zancadas: { name: 'Zancadas' },
    leg_press_gem: { name: 'Prensa Gemelo' },
    elev_front: { name: 'Elevaciones Frontales' },
  },
  configFields: [
    { key: 'press_mil_b1', label: 'Press Militar (Bloque 1)', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'press_mil_b2', label: 'Press Militar (Bloque 2)', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'bench_b1', label: 'Press Banca (Bloque 1)', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'bench_b2', label: 'Press Banca (Bloque 2)', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'squat_b1', label: 'Sentadilla (Bloque 1)', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'squat_b2', label: 'Sentadilla (Bloque 2)', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'deadlift_b1', label: 'Peso Muerto (Bloque 1)', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'deadlift_b2', label: 'Peso Muerto (Bloque 2)', type: 'weight', min: 2.5, step: 2.5 },
  ],
  weightIncrements: {
    press_mil: 2.5,
    bench: 2.5,
    squat: 2.5,
    deadlift: 2.5,
  },
  days: [
    // =====================================================================
    // BLOCK 1 — Weeks 1-3 (5×5 main lifts, 1×5 deadlift)
    // =====================================================================

    // --- Week 1 ---
    // Day 1: Lunes — Hombros / Tríceps
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        mainLift({ exerciseId: 'press_mil', block: 1, sets: 5, reps: 5 }),
        acc('press_franc', 't2', 4, 8),
        acc('ext_polea', 't3', 3, 12),
        acc('elev_lat', 't3', 4, 12),
        acc('elev_post', 't3', 3, 15),
      ],
    },
    // Day 2: Martes — Espalda / Gemelo
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        mainLift({ exerciseId: 'deadlift', block: 1, sets: 1, reps: 5, isDeadlift: true }),
        acc('remo_bar', 't2', 4, 8),
        acc('jalon', 't2', 4, 10),
        acc('face_pull', 't3', 3, 15),
        acc('gemelo_pie', 't3', 4, 12),
        acc('gemelo_sent', 't3', 3, 15),
      ],
    },
    // Day 3: Jueves — Pecho / Bíceps
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        mainLift({ exerciseId: 'bench', block: 1, sets: 5, reps: 5 }),
        acc('apert', 't2', 3, 12),
        acc('cruces', 't3', 3, 12),
        acc('curl_bar', 't2', 3, 10),
        acc('curl_alt', 't3', 3, 12),
      ],
    },
    // Day 4: Viernes — Pierna
    {
      name: 'Vie — Pierna',
      slots: [
        mainLift({ exerciseId: 'squat', block: 1, sets: 5, reps: 5 }),
        acc('prensa', 't2', 4, 10),
        acc('ext_quad', 't3', 3, 12),
        acc('curl_fem', 't3', 3, 12),
        acc('hip_thrust', 't2', 3, 10),
      ],
    },

    // --- Week 2 ---
    // Day 5: Lunes — Hombros / Tríceps
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        mainLift({ exerciseId: 'press_mil', block: 1, sets: 5, reps: 5 }),
        acc('press_franc', 't2', 4, 6),
        acc('ext_polea', 't3', 3, 10),
        acc('elev_lat', 't3', 4, 10),
        acc('elev_front', 't3', 3, 12),
      ],
    },
    // Day 6: Martes — Espalda / Gemelo
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        mainLift({ exerciseId: 'deadlift', block: 1, sets: 1, reps: 5, isDeadlift: true }),
        acc('remo_bar', 't2', 4, 6),
        acc('jalon', 't2', 4, 8),
        acc('face_pull', 't3', 3, 12),
        acc('gemelo_pie', 't3', 4, 10),
        acc('gemelo_sent', 't3', 3, 12),
      ],
    },
    // Day 7: Jueves — Pecho / Bíceps
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        mainLift({ exerciseId: 'bench', block: 1, sets: 5, reps: 5 }),
        acc('apert', 't2', 3, 10),
        acc('cruces', 't3', 3, 10),
        acc('curl_bar', 't2', 3, 8),
        acc('curl_mart', 't3', 3, 10),
      ],
    },
    // Day 8: Viernes — Pierna
    {
      name: 'Vie — Pierna',
      slots: [
        mainLift({ exerciseId: 'squat', block: 1, sets: 5, reps: 5 }),
        acc('prensa', 't2', 4, 8),
        acc('ext_quad', 't3', 3, 10),
        acc('curl_fem', 't3', 3, 10),
        acc('zancadas', 't2', 3, 10),
      ],
    },

    // --- Week 3 (record week) ---
    // Day 9: Lunes — Hombros / Tríceps
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        mainLift({ exerciseId: 'press_mil', block: 1, sets: 5, reps: 5 }),
        acc('press_franc', 't2', 5, 5),
        acc('ext_polea', 't3', 3, 8),
        acc('elev_lat', 't3', 3, 8),
        acc('elev_post', 't3', 3, 12),
      ],
    },
    // Day 10: Martes — Espalda / Gemelo
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        mainLift({ exerciseId: 'deadlift', block: 1, sets: 1, reps: 5, isDeadlift: true }),
        acc('remo_bar', 't2', 5, 5),
        acc('jalon', 't2', 4, 6),
        acc('face_pull', 't3', 3, 10),
        acc('gemelo_pie', 't3', 5, 8),
        acc('gemelo_sent', 't3', 3, 10),
      ],
    },
    // Day 11: Jueves — Pecho / Bíceps
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        mainLift({ exerciseId: 'bench', block: 1, sets: 5, reps: 5 }),
        acc('apert', 't2', 4, 8),
        acc('cruces', 't3', 3, 8),
        acc('curl_bar', 't2', 4, 6),
        acc('curl_alt', 't3', 3, 8),
      ],
    },
    // Day 12: Viernes — Pierna
    {
      name: 'Vie — Pierna',
      slots: [
        mainLift({ exerciseId: 'squat', block: 1, sets: 5, reps: 5 }),
        acc('prensa', 't2', 5, 6),
        acc('ext_quad', 't3', 4, 8),
        acc('curl_fem', 't3', 4, 8),
        acc('leg_press_gem', 't3', 4, 10),
      ],
    },

    // =====================================================================
    // BLOCK 2 — Weeks 4-6 (3×3 main lifts, 1×3 deadlift)
    // =====================================================================

    // --- Week 4 ---
    // Day 13: Lunes — Hombros / Tríceps
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        mainLift({ exerciseId: 'press_mil', block: 2, sets: 3, reps: 3 }),
        acc('press_franc', 't2', 4, 8),
        acc('ext_polea', 't3', 3, 12),
        acc('elev_lat', 't3', 4, 12),
        acc('elev_post', 't3', 3, 15),
      ],
    },
    // Day 14: Martes — Espalda / Gemelo
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        mainLift({ exerciseId: 'deadlift', block: 2, sets: 1, reps: 3, isDeadlift: true }),
        acc('remo_bar', 't2', 4, 8),
        acc('jalon', 't2', 4, 10),
        acc('face_pull', 't3', 3, 15),
        acc('gemelo_pie', 't3', 4, 12),
        acc('gemelo_sent', 't3', 3, 15),
      ],
    },
    // Day 15: Jueves — Pecho / Bíceps
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        mainLift({ exerciseId: 'bench', block: 2, sets: 3, reps: 3 }),
        acc('apert', 't2', 3, 12),
        acc('cruces', 't3', 3, 12),
        acc('curl_bar', 't2', 3, 10),
        acc('curl_alt', 't3', 3, 12),
      ],
    },
    // Day 16: Viernes — Pierna
    {
      name: 'Vie — Pierna',
      slots: [
        mainLift({ exerciseId: 'squat', block: 2, sets: 3, reps: 3 }),
        acc('prensa', 't2', 4, 10),
        acc('ext_quad', 't3', 3, 12),
        acc('curl_fem', 't3', 3, 12),
        acc('hip_thrust', 't2', 3, 10),
      ],
    },

    // --- Week 5 ---
    // Day 17: Lunes — Hombros / Tríceps
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        mainLift({ exerciseId: 'press_mil', block: 2, sets: 3, reps: 3 }),
        acc('press_franc', 't2', 4, 6),
        acc('ext_polea', 't3', 3, 10),
        acc('elev_lat', 't3', 4, 10),
        acc('elev_front', 't3', 3, 12),
      ],
    },
    // Day 18: Martes — Espalda / Gemelo
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        mainLift({ exerciseId: 'deadlift', block: 2, sets: 1, reps: 3, isDeadlift: true }),
        acc('remo_bar', 't2', 4, 6),
        acc('jalon', 't2', 4, 8),
        acc('face_pull', 't3', 3, 12),
        acc('gemelo_pie', 't3', 4, 10),
        acc('gemelo_sent', 't3', 3, 12),
      ],
    },
    // Day 19: Jueves — Pecho / Bíceps
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        mainLift({ exerciseId: 'bench', block: 2, sets: 3, reps: 3 }),
        acc('apert', 't2', 3, 10),
        acc('cruces', 't3', 3, 10),
        acc('curl_bar', 't2', 3, 8),
        acc('curl_mart', 't3', 3, 10),
      ],
    },
    // Day 20: Viernes — Pierna
    {
      name: 'Vie — Pierna',
      slots: [
        mainLift({ exerciseId: 'squat', block: 2, sets: 3, reps: 3 }),
        acc('prensa', 't2', 4, 8),
        acc('ext_quad', 't3', 3, 10),
        acc('curl_fem', 't3', 3, 10),
        acc('zancadas', 't2', 3, 10),
      ],
    },

    // --- Week 6 (record week) ---
    // Day 21: Lunes — Hombros / Tríceps
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        mainLift({ exerciseId: 'press_mil', block: 2, sets: 3, reps: 3 }),
        acc('press_franc', 't2', 5, 5),
        acc('ext_polea', 't3', 3, 8),
        acc('elev_lat', 't3', 3, 8),
        acc('elev_post', 't3', 3, 12),
      ],
    },
    // Day 22: Martes — Espalda / Gemelo
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        mainLift({ exerciseId: 'deadlift', block: 2, sets: 1, reps: 3, isDeadlift: true }),
        acc('remo_bar', 't2', 5, 5),
        acc('jalon', 't2', 4, 6),
        acc('face_pull', 't3', 3, 10),
        acc('gemelo_pie', 't3', 5, 8),
        acc('gemelo_sent', 't3', 3, 10),
      ],
    },
    // Day 23: Jueves — Pecho / Bíceps
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        mainLift({ exerciseId: 'bench', block: 2, sets: 3, reps: 3 }),
        acc('apert', 't2', 4, 8),
        acc('cruces', 't3', 3, 8),
        acc('curl_bar', 't2', 4, 6),
        acc('curl_alt', 't3', 3, 8),
      ],
    },
    // Day 24: Viernes — Pierna
    {
      name: 'Vie — Pierna',
      slots: [
        mainLift({ exerciseId: 'squat', block: 2, sets: 3, reps: 3 }),
        acc('prensa', 't2', 5, 6),
        acc('ext_quad', 't3', 4, 8),
        acc('curl_fem', 't3', 4, 8),
        acc('leg_press_gem', 't3', 4, 10),
      ],
    },
  ],
};
