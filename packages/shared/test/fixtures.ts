import type { StartWeights, Results } from '../src/types';
import type { ProgramDefinition } from '../src/types/program';

// ---------------------------------------------------------------------------
// GZCLP definition fixture (static copy of the production definition)
// ---------------------------------------------------------------------------

export const GZCLP_DEFINITION_FIXTURE: ProgramDefinition = {
  id: 'gzclp',
  name: 'GZCLP',
  description:
    'Un programa de progresión lineal basado en el método GZCL. ' +
    'Rotación de 4 días con ejercicios T1, T2 y T3 para desarrollar fuerza en los levantamientos compuestos principales.',
  author: 'Cody Lefever',
  version: 1,
  category: 'strength',
  source: 'preset',
  cycleLength: 4,
  totalWorkouts: 90,
  workoutsPerWeek: 3,
  exercises: {
    squat: { name: 'Sentadilla' },
    bench: { name: 'Press Banca' },
    deadlift: { name: 'Peso Muerto' },
    ohp: { name: 'Press Militar' },
    latpulldown: { name: 'Jalón al Pecho' },
    dbrow: { name: 'Remo con Mancuernas' },
  },
  configFields: [
    { key: 'squat', label: 'Sentadilla', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'bench', label: 'Press Banca', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'deadlift', label: 'Peso Muerto', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'ohp', label: 'Press Militar', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'latpulldown', label: 'Jalón al Pecho', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'dbrow', label: 'Remo con Mancuernas', type: 'weight', min: 2.5, step: 2.5 },
  ],
  weightIncrements: {
    squat: 5,
    bench: 2.5,
    deadlift: 5,
    ohp: 2.5,
    latpulldown: 2.5,
    dbrow: 2.5,
  },
  days: [
    {
      name: 'Día 1',
      slots: [
        {
          id: 'd1-t1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [
            { sets: 5, reps: 3 },
            { sets: 6, reps: 2 },
            { sets: 10, reps: 1 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'squat',
        },
        {
          id: 'd1-t2',
          exerciseId: 'bench',
          tier: 't2',
          stages: [
            { sets: 3, reps: 10 },
            { sets: 3, reps: 8 },
            { sets: 3, reps: 6 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
          startWeightKey: 'bench',
          startWeightMultiplier: 0.65,
        },
        {
          id: 'latpulldown-t3',
          exerciseId: 'latpulldown',
          tier: 't3',
          stages: [{ sets: 3, reps: 25, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onUndefined: { type: 'no_change' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'latpulldown',
        },
      ],
    },
    {
      name: 'Día 2',
      slots: [
        {
          id: 'd2-t1',
          exerciseId: 'ohp',
          tier: 't1',
          stages: [
            { sets: 5, reps: 3 },
            { sets: 6, reps: 2 },
            { sets: 10, reps: 1 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'ohp',
        },
        {
          id: 'd2-t2',
          exerciseId: 'deadlift',
          tier: 't2',
          stages: [
            { sets: 3, reps: 10 },
            { sets: 3, reps: 8 },
            { sets: 3, reps: 6 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
          startWeightKey: 'deadlift',
          startWeightMultiplier: 0.65,
        },
        {
          id: 'dbrow-t3',
          exerciseId: 'dbrow',
          tier: 't3',
          stages: [{ sets: 3, reps: 25, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onUndefined: { type: 'no_change' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'dbrow',
        },
      ],
    },
    {
      name: 'Día 3',
      slots: [
        {
          id: 'd3-t1',
          exerciseId: 'bench',
          tier: 't1',
          stages: [
            { sets: 5, reps: 3 },
            { sets: 6, reps: 2 },
            { sets: 10, reps: 1 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'bench',
        },
        {
          id: 'd3-t2',
          exerciseId: 'squat',
          tier: 't2',
          stages: [
            { sets: 3, reps: 10 },
            { sets: 3, reps: 8 },
            { sets: 3, reps: 6 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
          startWeightKey: 'squat',
          startWeightMultiplier: 0.65,
        },
        {
          id: 'latpulldown-t3',
          exerciseId: 'latpulldown',
          tier: 't3',
          stages: [{ sets: 3, reps: 25, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onUndefined: { type: 'no_change' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'latpulldown',
        },
      ],
    },
    {
      name: 'Día 4',
      slots: [
        {
          id: 'd4-t1',
          exerciseId: 'deadlift',
          tier: 't1',
          stages: [
            { sets: 5, reps: 3 },
            { sets: 6, reps: 2 },
            { sets: 10, reps: 1 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'deadlift',
        },
        {
          id: 'd4-t2',
          exerciseId: 'ohp',
          tier: 't2',
          stages: [
            { sets: 3, reps: 10 },
            { sets: 3, reps: 8 },
            { sets: 3, reps: 6 },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'add_weight_reset_stage', amount: 15 },
          startWeightKey: 'ohp',
          startWeightMultiplier: 0.65,
        },
        {
          id: 'dbrow-t3',
          exerciseId: 'dbrow',
          tier: 't3',
          stages: [{ sets: 3, reps: 25, amrap: true }],
          onSuccess: { type: 'add_weight' },
          onUndefined: { type: 'no_change' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'dbrow',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// GZCLP legacy constants (replaces imports from program.ts in tests)
// ---------------------------------------------------------------------------

export const DAYS = [
  { name: 'Día 1', t1: 'squat', t2: 'bench', t3: 'latpulldown' },
  { name: 'Día 2', t1: 'ohp', t2: 'deadlift', t3: 'dbrow' },
  { name: 'Día 3', t1: 'bench', t2: 'squat', t3: 'latpulldown' },
  { name: 'Día 4', t1: 'deadlift', t2: 'ohp', t3: 'dbrow' },
] as const;

export const T1_STAGES = [
  { sets: 5, reps: 3 },
  { sets: 6, reps: 2 },
  { sets: 10, reps: 1 },
] as const;

export const T2_STAGES = [
  { sets: 3, reps: 10 },
  { sets: 3, reps: 8 },
  { sets: 3, reps: 6 },
] as const;

export const TOTAL_WORKOUTS = 90;

// ---------------------------------------------------------------------------
// Nivel 7 definition fixture (replicated from the production generator)
// ---------------------------------------------------------------------------

type ProgramDay = ProgramDefinition['days'][number];
type ExerciseSlot = ProgramDay['slots'][number];
type ProgressionRule = ExerciseSlot['onSuccess'];

const NO_CHANGE: ProgressionRule = { type: 'no_change' };
const ADD_WEIGHT: ProgressionRule = { type: 'add_weight' };
const ADVANCE_STAGE: ProgressionRule = { type: 'advance_stage' };

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
}

function mainLift({ exerciseId, cycle, phase, sets, reps }: MainLiftOpts): ExerciseSlot {
  const isDeload = phase === 'b1d';
  return {
    id: `${exerciseId}-${cycle}${phase}`,
    exerciseId,
    tier: 't1',
    stages: [{ sets, reps }],
    onSuccess: isDeload ? NO_CHANGE : ADD_WEIGHT,
    onUndefined: isDeload ? NO_CHANGE : ADD_WEIGHT,
    onMidStageFail: NO_CHANGE,
    onFinalStageFail: NO_CHANGE,
    startWeightKey: exerciseId,
    startWeightOffset: PHASE_OFFSETS[cycle][phase],
  };
}

function dpAcc(exerciseId: string, tier: string): ExerciseSlot {
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

function cycleDays(cycle: Cycle): ProgramDay[] {
  const ml = (opts: Omit<MainLiftOpts, 'cycle'>): ExerciseSlot => mainLift({ ...opts, cycle });

  return [
    // BLOCK 1 — 5x5 main lifts, 1x5 deadlift
    // Week 1
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
        ml({ exerciseId: 'deadlift', phase: 'b1', sets: 1, reps: 5 }),
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
    // Week 2
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
        ml({ exerciseId: 'deadlift', phase: 'b1', sets: 1, reps: 5 }),
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
    // Week 3 (deload)
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
        ml({ exerciseId: 'deadlift', phase: 'b1d', sets: 1, reps: 5 }),
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
    // BLOCK 2 — 3x3 main lifts, 1x3 deadlift
    // Week 4
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
        ml({ exerciseId: 'deadlift', phase: 'b2', sets: 1, reps: 3 }),
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
    // Week 5
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
        ml({ exerciseId: 'deadlift', phase: 'b2', sets: 1, reps: 3 }),
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
    // Week 6 (record)
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
        ml({ exerciseId: 'deadlift', phase: 'b2', sets: 1, reps: 3 }),
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

export const NIVEL7_DEFINITION_FIXTURE: ProgramDefinition = {
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
  configTitle: 'Récords Objetivo (kg)',
  configDescription:
    'Configura el récord que quieres alcanzar en la semana 6 para los levantamientos principales, ' +
    'y el peso inicial de los accesorios.',
  configEditTitle: 'Editar Récords Objetivo (kg)',
  configEditDescription:
    'Actualiza tus récords objetivo — el programa se recalculará con los nuevos valores.',
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

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Default start weights used across all integration tests.
 * Matches the typical beginner GZCLP setup.
 */
export const DEFAULT_WEIGHTS: StartWeights = {
  squat: 60,
  bench: 40,
  deadlift: 80,
  ohp: 25,
  latpulldown: 30,
  dbrow: 15,
};

/** Build start weights with optional overrides. */
export function buildStartWeights(overrides?: Partial<StartWeights>): StartWeights {
  return { ...DEFAULT_WEIGHTS, ...overrides };
}

/** Build a results map from an array of [workoutIndex, result] tuples. */
export function buildResults(
  entries: Array<
    [
      number,
      {
        t1?: 'success' | 'fail';
        t2?: 'success' | 'fail';
        t3?: 'success' | 'fail';
        t1Reps?: number;
        t3Reps?: number;
      },
    ]
  >
): Results {
  const results: Results = {};
  for (const [index, result] of entries) {
    results[index] = result;
  }
  return results;
}

/** Build N consecutive workouts all marked as success for all tiers. */
export function buildSuccessfulResults(n: number): Results {
  const results: Results = {};
  for (let i = 0; i < n; i++) {
    results[i] = { t1: 'success', t2: 'success', t3: 'success' };
  }
  return results;
}
