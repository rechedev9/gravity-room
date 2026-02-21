import type { ProgramDefinition } from '../types/program';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Tier = 't1' | 't2' | 't3';
type ProgramDay = ProgramDefinition['days'][number];
type ExerciseSlot = ProgramDay['slots'][number];
type ProgressionRule = ExerciseSlot['onSuccess'];

const NO_CHANGE: ProgressionRule = { type: 'no_change' };
const ADD_WEIGHT: ProgressionRule = { type: 'add_weight' };
const ADVANCE_STAGE: ProgressionRule = { type: 'advance_stage' };

/**
 * Cycle-aware wave periodization.
 * Each cycle repeats the 6-week block structure with offsets shifted by −1,
 * so the effective target weight increases by one increment (+2.5kg) per cycle.
 *
 * Phases within each cycle:
 * - 'b1'  → Weeks 1-2 (build, +2.5kg/session)
 * - 'b1d' → Week 3   (deload, fixed weight = same as b1 start)
 * - 'b2'  → Weeks 4-6 (peak, +2.5kg/session, ends at cycle record)
 */
type Cycle = 'c1' | 'c2';
type SlotPhase = 'b1' | 'b1d' | 'b2';

const PHASE_OFFSETS: Record<Cycle, Record<SlotPhase, number>> = {
  c1: { b1: 4, b1d: 4, b2: 2 },
  c2: { b1: 3, b1d: 3, b2: 1 },
};

interface MainLiftOpts {
  readonly exerciseId: string;
  readonly cycle: Cycle;
  readonly phase: SlotPhase;
  readonly sets: number;
  readonly reps: number;
  readonly isDeadlift?: boolean;
}

function mainLift({
  exerciseId,
  cycle,
  phase,
  sets,
  reps,
  isDeadlift,
}: MainLiftOpts): ExerciseSlot {
  const isDeload = phase === 'b1d';
  return {
    id: `${exerciseId}-${cycle}${phase}`,
    exerciseId,
    tier: isDeadlift ? 't2' : 't1',
    stages: [{ sets, reps }],
    onSuccess: isDeload ? NO_CHANGE : ADD_WEIGHT,
    onUndefined: isDeload ? NO_CHANGE : ADD_WEIGHT,
    onMidStageFail: NO_CHANGE,
    onFinalStageFail: NO_CHANGE,
    startWeightKey: exerciseId,
    startWeightOffset: PHASE_OFFSETS[cycle][phase],
  };
}

/**
 * Double progression accessory: 3 sets × 8-12 reps.
 * On success: advance reps (8→9→…→12). At 12 reps: +2.5kg, reset to 8.
 * State (weight + stage) persists across all appearances via shared slot ID.
 */
function dpAcc(exerciseId: string, tier: Tier): ExerciseSlot {
  return {
    id: exerciseId,
    exerciseId,
    tier,
    stages: [
      { sets: 3, reps: 8 },
      { sets: 3, reps: 9 },
      { sets: 3, reps: 10 },
      { sets: 3, reps: 11 },
      { sets: 3, reps: 12 },
    ],
    onSuccess: ADVANCE_STAGE,
    onFinalStageSuccess: { type: 'add_weight_reset_stage', amount: 2.5 },
    onUndefined: ADVANCE_STAGE,
    onMidStageFail: NO_CHANGE,
    onFinalStageFail: NO_CHANGE,
    startWeightKey: exerciseId,
  };
}

// ---------------------------------------------------------------------------
// Cycle day generator — 24 days per cycle, parameterized by cycle
// ---------------------------------------------------------------------------

function cycleDays(cycle: Cycle): ProgramDay[] {
  const ml = (opts: Omit<MainLiftOpts, 'cycle'>): ExerciseSlot => mainLift({ ...opts, cycle });

  return [
    // =================================================================
    // BLOCK 1 — 5×5 main lifts, 1×5 deadlift
    // =================================================================

    // --- Week 1 ---
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        ml({ exerciseId: 'press_mil', phase: 'b1', sets: 5, reps: 5 }),
        dpAcc('press_franc', 't2'),
        dpAcc('ext_polea', 't3'),
        dpAcc('elev_lat', 't3'),
        dpAcc('elev_post', 't3'),
      ],
    },
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        ml({ exerciseId: 'deadlift', phase: 'b1', sets: 1, reps: 5, isDeadlift: true }),
        dpAcc('remo_bar', 't2'),
        dpAcc('jalon', 't2'),
        dpAcc('face_pull', 't3'),
        dpAcc('gemelo_pie', 't3'),
        dpAcc('gemelo_sent', 't3'),
      ],
    },
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        ml({ exerciseId: 'bench', phase: 'b1', sets: 5, reps: 5 }),
        dpAcc('apert', 't2'),
        dpAcc('cruces', 't3'),
        dpAcc('curl_bar', 't2'),
        dpAcc('curl_alt', 't3'),
      ],
    },
    {
      name: 'Vie — Pierna',
      slots: [
        ml({ exerciseId: 'squat', phase: 'b1', sets: 5, reps: 5 }),
        dpAcc('prensa', 't2'),
        dpAcc('ext_quad', 't3'),
        dpAcc('curl_fem', 't3'),
        dpAcc('hip_thrust', 't2'),
      ],
    },

    // --- Week 2 ---
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        ml({ exerciseId: 'press_mil', phase: 'b1', sets: 5, reps: 5 }),
        dpAcc('press_franc', 't2'),
        dpAcc('ext_polea', 't3'),
        dpAcc('elev_lat', 't3'),
        dpAcc('elev_front', 't3'),
      ],
    },
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        ml({ exerciseId: 'deadlift', phase: 'b1', sets: 1, reps: 5, isDeadlift: true }),
        dpAcc('remo_bar', 't2'),
        dpAcc('jalon', 't2'),
        dpAcc('face_pull', 't3'),
        dpAcc('gemelo_pie', 't3'),
        dpAcc('gemelo_sent', 't3'),
      ],
    },
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        ml({ exerciseId: 'bench', phase: 'b1', sets: 5, reps: 5 }),
        dpAcc('apert', 't2'),
        dpAcc('cruces', 't3'),
        dpAcc('curl_bar', 't2'),
        dpAcc('curl_mart', 't3'),
      ],
    },
    {
      name: 'Vie — Pierna',
      slots: [
        ml({ exerciseId: 'squat', phase: 'b1', sets: 5, reps: 5 }),
        dpAcc('prensa', 't2'),
        dpAcc('ext_quad', 't3'),
        dpAcc('curl_fem', 't3'),
        dpAcc('zancadas', 't2'),
      ],
    },

    // --- Week 3 (deload) ---
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        ml({ exerciseId: 'press_mil', phase: 'b1d', sets: 5, reps: 5 }),
        dpAcc('press_franc', 't2'),
        dpAcc('ext_polea', 't3'),
        dpAcc('elev_lat', 't3'),
        dpAcc('elev_post', 't3'),
      ],
    },
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        ml({ exerciseId: 'deadlift', phase: 'b1d', sets: 1, reps: 5, isDeadlift: true }),
        dpAcc('remo_bar', 't2'),
        dpAcc('jalon', 't2'),
        dpAcc('face_pull', 't3'),
        dpAcc('gemelo_pie', 't3'),
        dpAcc('gemelo_sent', 't3'),
      ],
    },
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        ml({ exerciseId: 'bench', phase: 'b1d', sets: 5, reps: 5 }),
        dpAcc('apert', 't2'),
        dpAcc('cruces', 't3'),
        dpAcc('curl_bar', 't2'),
        dpAcc('curl_alt', 't3'),
      ],
    },
    {
      name: 'Vie — Pierna',
      slots: [
        ml({ exerciseId: 'squat', phase: 'b1d', sets: 5, reps: 5 }),
        dpAcc('prensa', 't2'),
        dpAcc('ext_quad', 't3'),
        dpAcc('curl_fem', 't3'),
        dpAcc('leg_press_gem', 't3'),
      ],
    },

    // =================================================================
    // BLOCK 2 — 3×3 main lifts, 1×3 deadlift
    // =================================================================

    // --- Week 4 ---
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        ml({ exerciseId: 'press_mil', phase: 'b2', sets: 3, reps: 3 }),
        dpAcc('press_franc', 't2'),
        dpAcc('ext_polea', 't3'),
        dpAcc('elev_lat', 't3'),
        dpAcc('elev_post', 't3'),
      ],
    },
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        ml({ exerciseId: 'deadlift', phase: 'b2', sets: 1, reps: 3, isDeadlift: true }),
        dpAcc('remo_bar', 't2'),
        dpAcc('jalon', 't2'),
        dpAcc('face_pull', 't3'),
        dpAcc('gemelo_pie', 't3'),
        dpAcc('gemelo_sent', 't3'),
      ],
    },
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        ml({ exerciseId: 'bench', phase: 'b2', sets: 3, reps: 3 }),
        dpAcc('apert', 't2'),
        dpAcc('cruces', 't3'),
        dpAcc('curl_bar', 't2'),
        dpAcc('curl_alt', 't3'),
      ],
    },
    {
      name: 'Vie — Pierna',
      slots: [
        ml({ exerciseId: 'squat', phase: 'b2', sets: 3, reps: 3 }),
        dpAcc('prensa', 't2'),
        dpAcc('ext_quad', 't3'),
        dpAcc('curl_fem', 't3'),
        dpAcc('hip_thrust', 't2'),
      ],
    },

    // --- Week 5 ---
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        ml({ exerciseId: 'press_mil', phase: 'b2', sets: 3, reps: 3 }),
        dpAcc('press_franc', 't2'),
        dpAcc('ext_polea', 't3'),
        dpAcc('elev_lat', 't3'),
        dpAcc('elev_front', 't3'),
      ],
    },
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        ml({ exerciseId: 'deadlift', phase: 'b2', sets: 1, reps: 3, isDeadlift: true }),
        dpAcc('remo_bar', 't2'),
        dpAcc('jalon', 't2'),
        dpAcc('face_pull', 't3'),
        dpAcc('gemelo_pie', 't3'),
        dpAcc('gemelo_sent', 't3'),
      ],
    },
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        ml({ exerciseId: 'bench', phase: 'b2', sets: 3, reps: 3 }),
        dpAcc('apert', 't2'),
        dpAcc('cruces', 't3'),
        dpAcc('curl_bar', 't2'),
        dpAcc('curl_mart', 't3'),
      ],
    },
    {
      name: 'Vie — Pierna',
      slots: [
        ml({ exerciseId: 'squat', phase: 'b2', sets: 3, reps: 3 }),
        dpAcc('prensa', 't2'),
        dpAcc('ext_quad', 't3'),
        dpAcc('curl_fem', 't3'),
        dpAcc('zancadas', 't2'),
      ],
    },

    // --- Week 6 (record) ---
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        ml({ exerciseId: 'press_mil', phase: 'b2', sets: 3, reps: 3 }),
        dpAcc('press_franc', 't2'),
        dpAcc('ext_polea', 't3'),
        dpAcc('elev_lat', 't3'),
        dpAcc('elev_post', 't3'),
      ],
    },
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        ml({ exerciseId: 'deadlift', phase: 'b2', sets: 1, reps: 3, isDeadlift: true }),
        dpAcc('remo_bar', 't2'),
        dpAcc('jalon', 't2'),
        dpAcc('face_pull', 't3'),
        dpAcc('gemelo_pie', 't3'),
        dpAcc('gemelo_sent', 't3'),
      ],
    },
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        ml({ exerciseId: 'bench', phase: 'b2', sets: 3, reps: 3 }),
        dpAcc('apert', 't2'),
        dpAcc('cruces', 't3'),
        dpAcc('curl_bar', 't2'),
        dpAcc('curl_alt', 't3'),
      ],
    },
    {
      name: 'Vie — Pierna',
      slots: [
        ml({ exerciseId: 'squat', phase: 'b2', sets: 3, reps: 3 }),
        dpAcc('prensa', 't2'),
        dpAcc('ext_quad', 't3'),
        dpAcc('curl_fem', 't3'),
        dpAcc('leg_press_gem', 't3'),
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// Nivel 7 Definition
// ---------------------------------------------------------------------------

/**
 * Nivel 7 — 12-week strength program by "nivel7" (musclecoop forum).
 *
 * Two 6-week cycles, each with Block 1 (5×5) and Block 2 (3×3).
 * 4 days/week: Lunes (Hombros/Tríceps), Martes (Espalda/Gemelo),
 *              Jueves (Pecho/Bíceps), Viernes (Pierna).
 *
 * Main lifts: target-based wave periodization (user inputs week-6 record).
 * Accessories: double progression 3×8-12 (+2.5kg when 3×12 completed, reset to 3×8).
 * Cycle 2 repeats the main lift pattern with the target shifted +2.5kg.
 */
export const NIVEL7_DEFINITION: ProgramDefinition = {
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
  cycleLength: 48,
  totalWorkouts: 48,
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
    // --- Main lifts (week-6 record targets) ---
    {
      key: 'press_mil',
      label: 'Press Militar (récord sem. 6)',
      type: 'weight',
      min: 2.5,
      step: 2.5,
      group: 'Objetivos principales (sem. 6)',
    },
    {
      key: 'bench',
      label: 'Press Banca (récord sem. 6)',
      type: 'weight',
      min: 2.5,
      step: 2.5,
      group: 'Objetivos principales (sem. 6)',
    },
    {
      key: 'squat',
      label: 'Sentadilla (récord sem. 6)',
      type: 'weight',
      min: 2.5,
      step: 2.5,
      group: 'Objetivos principales (sem. 6)',
    },
    {
      key: 'deadlift',
      label: 'Peso Muerto (récord sem. 6)',
      type: 'weight',
      min: 2.5,
      step: 2.5,
      group: 'Objetivos principales (sem. 6)',
    },

    // --- Hombros / Tríceps ---
    {
      key: 'press_franc',
      label: 'Press Francés',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Hombros / Tríceps',
    },
    {
      key: 'ext_polea',
      label: 'Extensión Polea',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Hombros / Tríceps',
    },
    {
      key: 'elev_lat',
      label: 'Elevaciones Laterales',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Hombros / Tríceps',
    },
    {
      key: 'elev_post',
      label: 'Elevaciones Posteriores',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Hombros / Tríceps',
    },
    {
      key: 'elev_front',
      label: 'Elevaciones Frontales',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Hombros / Tríceps',
    },

    // --- Espalda / Gemelo ---
    {
      key: 'remo_bar',
      label: 'Remo con Barra',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Espalda / Gemelo',
    },
    {
      key: 'jalon',
      label: 'Jalón al Pecho',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Espalda / Gemelo',
    },
    {
      key: 'face_pull',
      label: 'Face Pull',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Espalda / Gemelo',
    },
    {
      key: 'gemelo_pie',
      label: 'Gemelo de Pie',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Espalda / Gemelo',
    },
    {
      key: 'gemelo_sent',
      label: 'Gemelo Sentado',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Espalda / Gemelo',
    },

    // --- Pecho / Bíceps ---
    {
      key: 'apert',
      label: 'Aperturas',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Pecho / Bíceps',
    },
    {
      key: 'cruces',
      label: 'Cruces en Polea',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Pecho / Bíceps',
    },
    {
      key: 'curl_bar',
      label: 'Curl con Barra',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Pecho / Bíceps',
    },
    {
      key: 'curl_alt',
      label: 'Curl Alterno',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Pecho / Bíceps',
    },
    {
      key: 'curl_mart',
      label: 'Curl Martillo',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Pecho / Bíceps',
    },

    // --- Pierna ---
    {
      key: 'prensa',
      label: 'Prensa',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Pierna',
    },
    {
      key: 'ext_quad',
      label: 'Extensión Cuádriceps',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Pierna',
    },
    {
      key: 'curl_fem',
      label: 'Curl Femoral',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Pierna',
    },
    {
      key: 'hip_thrust',
      label: 'Hip Thrust',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Pierna',
    },
    {
      key: 'zancadas',
      label: 'Zancadas',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Pierna',
    },
    {
      key: 'leg_press_gem',
      label: 'Prensa Gemelo',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Pierna',
    },
  ],
  weightIncrements: {
    press_mil: 2.5,
    bench: 2.5,
    squat: 2.5,
    deadlift: 2.5,
  },
  days: [...cycleDays('c1'), ...cycleDays('c2')],
};
