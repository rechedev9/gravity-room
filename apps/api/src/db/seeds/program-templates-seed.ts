/**
 * Idempotent seed for the program_templates table.
 * Inserts 7 preset programs with their full JSONB definitions.
 * Exercise names are omitted from JSONB — they are resolved from the exercises table at hydration time.
 * Uses onConflictDoNothing() to allow re-runs without error.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { programTemplates } from '../schema';
import type * as schema from '../schema';

type DbClient = PostgresJsDatabase<typeof schema>;

// ---------------------------------------------------------------------------
// GZCLP Definition JSONB
// ---------------------------------------------------------------------------

const GZCLP_DEFINITION_JSONB = {
  cycleLength: 4,
  totalWorkouts: 90,
  workoutsPerWeek: 3,
  exercises: {
    squat: {},
    bench: {},
    deadlift: {},
    ohp: {},
    latpulldown: {},
    dbrow: {},
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
            { sets: 5, reps: 3, amrap: true },
            { sets: 6, reps: 2, amrap: true },
            { sets: 10, reps: 1, amrap: true },
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
            { sets: 5, reps: 3, amrap: true },
            { sets: 6, reps: 2, amrap: true },
            { sets: 10, reps: 1, amrap: true },
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
            { sets: 5, reps: 3, amrap: true },
            { sets: 6, reps: 2, amrap: true },
            { sets: 10, reps: 1, amrap: true },
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
            { sets: 5, reps: 3, amrap: true },
            { sets: 6, reps: 2, amrap: true },
            { sets: 10, reps: 1, amrap: true },
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
// PPL 5/3/1 Definition JSONB
// ---------------------------------------------------------------------------

// Helpers mirroring the original TypeScript helpers but producing plain objects

interface SlotDef {
  readonly id: string;
  readonly exerciseId: string;
  readonly tier: string;
  readonly stages: readonly {
    readonly sets: number;
    readonly reps: number;
    readonly amrap?: boolean;
    readonly repsMax?: number;
  }[];
  readonly onSuccess: {
    readonly type: string;
    readonly amount?: number;
    readonly minAmrapReps?: number;
  };
  readonly onFinalStageSuccess?: { readonly type: string; readonly amount?: number };
  readonly onUndefined?: { readonly type: string };
  readonly onMidStageFail: { readonly type: string };
  readonly onFinalStageFail: { readonly type: string; readonly percent?: number };
  readonly startWeightKey: string;
  readonly startWeightMultiplier?: number;
  readonly startWeightOffset?: number;
  readonly role?: string;
  readonly trainingMaxKey?: string;
  readonly tmPercent?: number;
}

const NC = { type: 'no_change' } as const;
const ADV = { type: 'advance_stage' } as const;

function pplMainWork(exerciseId: string, slotId: string, tmKey: string): SlotDef {
  return {
    id: `${slotId}_work`,
    exerciseId,
    tier: 'main',
    role: 'secondary',
    trainingMaxKey: tmKey,
    tmPercent: 0.75,
    stages: [{ sets: 1, reps: 5 }],
    onSuccess: NC,
    onUndefined: NC,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: tmKey,
  };
}

function pplMainAmrap(exerciseId: string, slotId: string, tmKey: string, inc: number): SlotDef {
  return {
    id: `${slotId}_amrap`,
    exerciseId,
    tier: 'main',
    role: 'primary',
    trainingMaxKey: tmKey,
    tmPercent: 0.85,
    stages: [{ sets: 1, reps: 5, amrap: true }],
    onSuccess: { type: 'update_tm', amount: inc, minAmrapReps: 5 },
    onUndefined: NC,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: tmKey,
  };
}

function pplSecondary(
  exerciseId: string,
  slotId: string,
  tmKey: string,
  pct: number,
  sets: number,
  reps: number
): SlotDef {
  return {
    id: slotId,
    exerciseId,
    tier: 'secondary',
    role: 'secondary',
    trainingMaxKey: tmKey,
    tmPercent: pct,
    stages: [{ sets, reps }],
    onSuccess: NC,
    onUndefined: NC,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: tmKey,
  };
}

function pplDp810(exerciseId: string, inc: number, sets: number, slotId?: string): SlotDef {
  return {
    id: slotId ?? exerciseId,
    exerciseId,
    tier: 'accessory',
    role: 'accessory',
    stages: [
      { sets, reps: 8, repsMax: 10 },
      { sets, reps: 9, repsMax: 10 },
      { sets, reps: 10, repsMax: 10 },
    ],
    onSuccess: ADV,
    onFinalStageSuccess: { type: 'add_weight_reset_stage', amount: inc },
    onUndefined: ADV,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: slotId ?? exerciseId,
  };
}

function pplDp1520(exerciseId: string, inc: number, sets: number, slotId?: string): SlotDef {
  return {
    id: slotId ?? exerciseId,
    exerciseId,
    tier: 'accessory',
    role: 'accessory',
    stages: [
      { sets, reps: 15, repsMax: 20 },
      { sets, reps: 16, repsMax: 20 },
      { sets, reps: 17, repsMax: 20 },
      { sets, reps: 18, repsMax: 20 },
      { sets, reps: 19, repsMax: 20 },
      { sets, reps: 20, repsMax: 20 },
    ],
    onSuccess: ADV,
    onFinalStageSuccess: { type: 'add_weight_reset_stage', amount: inc },
    onUndefined: ADV,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: slotId ?? exerciseId,
  };
}

const PPL531_DAYS = [
  // Pull A
  {
    name: 'Pull A',
    slots: [
      pplMainWork('deadlift', 'deadlift_main', 'deadlift_tm'),
      pplMainAmrap('deadlift', 'deadlift_main', 'deadlift_tm', 5),
      pplDp810('lat_pulldown', 2.5, 3),
      pplDp810('seated_row', 2.5, 3),
      pplDp1520('face_pull', 2.5, 3),
      pplDp810('hammer_curl', 0.5, 3, 'hammer_curl_a'),
      pplDp810('incline_curl', 0.5, 3),
    ],
  },
  // Push A
  {
    name: 'Push A',
    slots: [
      pplMainWork('bench', 'bench_main', 'bench_tm'),
      pplMainAmrap('bench', 'bench_main', 'bench_tm', 2.5),
      pplSecondary('ohp', 'ohp_secondary', 'ohp_tm', 0.5, 3, 10),
      pplDp810('incline_db_press', 0.5, 3),
      pplDp810('triceps_pushdown', 2.5, 3),
      pplDp810('triceps_extension', 2.5, 3),
      pplDp1520('lateral_raise', 0.5, 3),
    ],
  },
  // Legs A
  {
    name: 'Legs A',
    slots: [
      pplMainWork('squat', 'squat_main', 'squat_tm'),
      pplMainAmrap('squat', 'squat_main', 'squat_tm', 5),
      pplDp810('barbell_rdl', 0.5, 3),
      pplDp810('bulgarian_split_squat', 0.5, 3),
      pplDp810('cable_pull_through', 2.5, 3),
      pplDp810('standing_calf_raise', 2.5, 5),
    ],
  },
  // Pull B
  {
    name: 'Pull B',
    slots: [
      pplMainWork('pullup', 'pullup_main', 'pullup_tm'),
      pplMainAmrap('pullup', 'pullup_main', 'pullup_tm', 2.5),
      pplDp810('bent_over_row', 0.5, 3),
      pplDp810('seated_row', 2.5, 3),
      pplDp1520('incline_row', 2.5, 5),
      pplDp810('hammer_curl', 0.5, 4, 'hammer_curl_b'),
      pplDp810('lying_bicep_curl', 0.5, 4),
    ],
  },
  // Push B
  {
    name: 'Push B',
    slots: [
      pplMainWork('ohp', 'ohp_main', 'ohp_tm'),
      pplMainAmrap('ohp', 'ohp_main', 'ohp_tm', 2.5),
      pplSecondary('bench', 'bench_secondary', 'bench_tm', 0.5, 3, 10),
      pplDp810('incline_db_press', 0.5, 3),
      pplDp810('triceps_pushdown', 2.5, 3),
      pplDp810('triceps_extension', 2.5, 3),
      pplDp1520('lateral_raise', 0.5, 3),
    ],
  },
  // Legs B
  {
    name: 'Legs B',
    slots: [
      pplSecondary('squat', 'squat_secondary', 'squat_tm', 0.6, 3, 8),
      pplDp810('dumbbell_rdl', 0.5, 3),
      pplDp810('bulgarian_split_squat', 0.5, 3),
      pplDp810('seated_leg_curl', 2.5, 3),
      pplDp810('standing_calf_raise', 2.5, 5),
    ],
  },
];

const PPL531_DEFINITION_JSONB = {
  cycleLength: 6,
  totalWorkouts: 156,
  workoutsPerWeek: 6,
  exercises: {
    deadlift: {},
    bench: {},
    squat: {},
    pullup: {},
    ohp: {},
    lat_pulldown: {},
    seated_row: {},
    face_pull: {},
    hammer_curl: {},
    incline_curl: {},
    bent_over_row: {},
    incline_row: {},
    lying_bicep_curl: {},
    incline_db_press: {},
    triceps_pushdown: {},
    triceps_extension: {},
    lateral_raise: {},
    barbell_rdl: {},
    dumbbell_rdl: {},
    bulgarian_split_squat: {},
    cable_pull_through: {},
    standing_calf_raise: {},
    seated_leg_curl: {},
  },
  configFields: [
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
  days: PPL531_DAYS,
};

// ---------------------------------------------------------------------------
// StrongLifts 5x5 Definition JSONB
// ---------------------------------------------------------------------------

function sl5x5Slot(id: string, exerciseId: string, sets: number, reps: number): SlotDef {
  return {
    id,
    exerciseId,
    tier: 'main',
    stages: [
      { sets, reps },
      { sets, reps },
      { sets, reps },
    ],
    onSuccess: {
      type: 'add_weight_reset_stage',
      amount: exerciseId === 'deadlift' ? 5 : 2.5,
    },
    onMidStageFail: ADV,
    onFinalStageFail: { type: 'deload_percent', percent: 10 },
    startWeightKey: exerciseId,
  };
}

const STRONGLIFTS_DEFINITION_JSONB = {
  cycleLength: 2,
  totalWorkouts: 90,
  workoutsPerWeek: 3,
  exercises: {
    squat: {},
    bench: {},
    ohp: {},
    deadlift: {},
    bent_over_row: {},
  },
  configFields: [
    { key: 'squat', label: 'Sentadilla', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'bench', label: 'Press Banca', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'ohp', label: 'Press Militar', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'deadlift', label: 'Peso Muerto', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'bent_over_row', label: 'Remo con Barra', type: 'weight', min: 2.5, step: 2.5 },
  ],
  weightIncrements: {
    squat: 2.5,
    bench: 2.5,
    ohp: 2.5,
    deadlift: 5,
    bent_over_row: 2.5,
  },
  days: [
    {
      name: 'Workout A',
      slots: [
        sl5x5Slot('squat', 'squat', 5, 5),
        sl5x5Slot('bench', 'bench', 5, 5),
        sl5x5Slot('bent_over_row', 'bent_over_row', 5, 5),
      ],
    },
    {
      name: 'Workout B',
      slots: [
        sl5x5Slot('squat', 'squat', 5, 5),
        sl5x5Slot('ohp', 'ohp', 5, 5),
        sl5x5Slot('deadlift', 'deadlift', 1, 5),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Phrak's Greyskull LP Definition JSONB
// ---------------------------------------------------------------------------

function gslpSlot(id: string, exerciseId: string, sets: number): SlotDef {
  return {
    id,
    exerciseId,
    tier: 'main',
    stages: [{ sets, reps: 5, amrap: true }],
    onSuccess: { type: 'add_weight' },
    onMidStageFail: NC,
    onFinalStageFail: { type: 'deload_percent', percent: 10 },
    startWeightKey: exerciseId,
  };
}

const GSLP_DEFINITION_JSONB = {
  cycleLength: 2,
  totalWorkouts: 90,
  workoutsPerWeek: 3,
  exercises: {
    ohp: {},
    pullup: {},
    squat: {},
    bench: {},
    bent_over_row: {},
    deadlift: {},
  },
  configFields: [
    { key: 'ohp', label: 'Press Militar', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'pullup', label: 'Dominadas (peso añadido)', type: 'weight', min: 0, step: 2.5 },
    { key: 'squat', label: 'Sentadilla', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'bench', label: 'Press Banca', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'bent_over_row', label: 'Remo con Barra', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'deadlift', label: 'Peso Muerto', type: 'weight', min: 2.5, step: 2.5 },
  ],
  weightIncrements: {
    ohp: 2.5,
    pullup: 2.5,
    squat: 2.5,
    bench: 2.5,
    bent_over_row: 2.5,
    deadlift: 5,
  },
  days: [
    {
      name: 'Workout A',
      slots: [
        gslpSlot('ohp', 'ohp', 3),
        gslpSlot('pullup', 'pullup', 3),
        gslpSlot('squat', 'squat', 3),
      ],
    },
    {
      name: 'Workout B',
      slots: [
        gslpSlot('bench', 'bench', 3),
        gslpSlot('bent_over_row', 'bent_over_row', 3),
        gslpSlot('deadlift', 'deadlift', 1),
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// 5/3/1 Boring But Big (BBB) Definition JSONB
// ---------------------------------------------------------------------------

function bbbSlot(
  exerciseId: string,
  tmKey: string,
  id: string,
  pct: number,
  reps: number,
  sets: number = 1,
  tier: string = 'main'
): SlotDef {
  return {
    id,
    exerciseId,
    tier,
    role: 'secondary',
    trainingMaxKey: tmKey,
    tmPercent: pct,
    stages: [{ sets, reps }],
    onSuccess: NC,
    onUndefined: NC,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: tmKey,
  };
}

function bbbTopSlot(
  exerciseId: string,
  tmKey: string,
  pct: number,
  reps: number,
  amrap: boolean,
  tmInc?: number
): SlotDef {
  return {
    id: `${exerciseId}_top`,
    exerciseId,
    tier: 'main',
    role: 'primary',
    trainingMaxKey: tmKey,
    tmPercent: pct,
    stages: [{ sets: 1, reps, amrap: amrap || undefined }],
    onSuccess: tmInc !== undefined ? { type: 'update_tm', amount: tmInc, minAmrapReps: 1 } : NC,
    onUndefined: NC,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: tmKey,
  };
}

function bbbWeekDays(
  label: string,
  p1: number,
  p2: number,
  p3: number,
  r1: number,
  r2: number,
  r3: number,
  amrap: boolean,
  bbb: boolean,
  tmUpdate: boolean
): { name: string; slots: SlotDef[] }[] {
  const lifts = [
    { ex: 'squat', tm: 'squat_tm', name: 'Sentadilla', inc: 5 },
    { ex: 'bench', tm: 'bench_tm', name: 'Press Banca', inc: 2.5 },
    { ex: 'deadlift', tm: 'deadlift_tm', name: 'Peso Muerto', inc: 5 },
    { ex: 'ohp', tm: 'ohp_tm', name: 'Press Militar', inc: 2.5 },
  ];
  return lifts.map((l) => ({
    name: `${label} — ${l.name}`,
    slots: [
      bbbSlot(l.ex, l.tm, `${l.ex}_s1`, p1, r1),
      bbbSlot(l.ex, l.tm, `${l.ex}_s2`, p2, r2),
      bbbTopSlot(l.ex, l.tm, p3, r3, amrap, tmUpdate ? l.inc : undefined),
      ...(bbb ? [bbbSlot(l.ex, l.tm, `${l.ex}_bbb`, 0.5, 10, 5, 'supplemental')] : []),
    ],
  }));
}

const BBB_DAYS = [
  ...bbbWeekDays('Sem. 1 (5s)', 0.65, 0.75, 0.85, 5, 5, 5, true, true, false),
  ...bbbWeekDays('Sem. 2 (3s)', 0.7, 0.8, 0.9, 3, 3, 3, true, true, false),
  ...bbbWeekDays('Sem. 3 (5/3/1)', 0.75, 0.85, 0.95, 5, 3, 1, true, true, true),
  ...bbbWeekDays('Descarga', 0.4, 0.5, 0.6, 5, 5, 5, false, false, false),
];

const BBB_DEFINITION_JSONB = {
  configTitle: 'Training Max (kg)',
  configDescription:
    'Introduce tu Training Max para cada levantamiento principal. ' +
    'Se recomienda usar el 90% de tu 1RM.',
  configEditTitle: 'Editar Training Max (kg)',
  configEditDescription:
    'Actualiza tu Training Max — el programa se recalculará con los nuevos valores.',
  cycleLength: 16,
  totalWorkouts: 80,
  workoutsPerWeek: 4,
  exercises: {
    squat: {},
    bench: {},
    deadlift: {},
    ohp: {},
  },
  configFields: [
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
  ],
  weightIncrements: {},
  days: BBB_DAYS,
};

// ---------------------------------------------------------------------------
// 5/3/1 for Beginners Definition JSONB
// ---------------------------------------------------------------------------

function fsl531WeekDays(
  label: string,
  p1: number,
  p2: number,
  p3: number,
  r1: number,
  r2: number,
  r3: number,
  tmUpdate: boolean
): { name: string; slots: SlotDef[] }[] {
  const dayConfigs = [
    {
      name: 'Sentadilla + Press Banca',
      lifts: [
        { ex: 'squat', tm: 'squat_tm', inc: 5 },
        { ex: 'bench', tm: 'bench_tm', inc: 2.5 },
      ],
      isFirst: true,
    },
    {
      name: 'Peso Muerto + Press Militar',
      lifts: [
        { ex: 'deadlift', tm: 'deadlift_tm', inc: 5 },
        { ex: 'ohp', tm: 'ohp_tm', inc: 2.5 },
      ],
      isFirst: true,
    },
    {
      name: 'Press Banca + Sentadilla',
      lifts: [
        { ex: 'bench', tm: 'bench_tm', inc: 2.5 },
        { ex: 'squat', tm: 'squat_tm', inc: 5 },
      ],
      isFirst: false,
    },
  ];
  return dayConfigs.map((d) => ({
    name: `${label} — ${d.name}`,
    slots: d.lifts.flatMap((l) => [
      bbbSlot(l.ex, l.tm, `${l.ex}_s1`, p1, r1),
      bbbSlot(l.ex, l.tm, `${l.ex}_s2`, p2, r2),
      bbbTopSlot(l.ex, l.tm, p3, r3, true, tmUpdate && d.isFirst ? l.inc : undefined),
      bbbSlot(l.ex, l.tm, `${l.ex}_fsl`, p1, 5, 5, 'supplemental'),
    ]),
  }));
}

const FSL531_DAYS = [
  ...fsl531WeekDays('Sem. 1 (5s)', 0.65, 0.75, 0.85, 5, 5, 5, false),
  ...fsl531WeekDays('Sem. 2 (3s)', 0.7, 0.8, 0.9, 3, 3, 3, false),
  ...fsl531WeekDays('Sem. 3 (5/3/1)', 0.75, 0.85, 0.95, 5, 3, 1, true),
];

const FSL531_DEFINITION_JSONB = {
  configTitle: 'Training Max (kg)',
  configDescription:
    'Introduce tu Training Max para cada levantamiento principal. ' +
    'Se recomienda usar el 90% de tu 1RM.',
  configEditTitle: 'Editar Training Max (kg)',
  configEditDescription:
    'Actualiza tu Training Max — el programa se recalculará con los nuevos valores.',
  cycleLength: 9,
  totalWorkouts: 72,
  workoutsPerWeek: 3,
  exercises: {
    squat: {},
    bench: {},
    deadlift: {},
    ohp: {},
  },
  configFields: [
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
  ],
  weightIncrements: {},
  days: FSL531_DAYS,
};

// ---------------------------------------------------------------------------
// Nivel 7 Definition JSONB
// ---------------------------------------------------------------------------

type Cycle = 'c1' | 'c2';
type Phase = 'b1' | 'b1d' | 'b2';

const PHASE_OFFSETS: Readonly<Record<Cycle, Readonly<Record<Phase, number>>>> = {
  c1: { b1: 4, b1d: 4, b2: 2 },
  c2: { b1: 3, b1d: 3, b2: 1 },
};

function n7Main(
  exerciseId: string,
  cycle: Cycle,
  phase: Phase,
  sets: number,
  reps: number
): SlotDef {
  const isDeload = phase === 'b1d';
  return {
    id: `${exerciseId}-${cycle}${phase}`,
    exerciseId,
    tier: 't1',
    stages: [{ sets, reps }],
    onSuccess: isDeload ? NC : { type: 'add_weight' },
    onUndefined: isDeload ? NC : { type: 'add_weight' },
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: exerciseId,
    startWeightOffset: PHASE_OFFSETS[cycle][phase],
  };
}

function n7Acc(exerciseId: string, tier: string): SlotDef {
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
    onSuccess: ADV,
    onFinalStageSuccess: { type: 'add_weight_reset_stage', amount: 2.5 },
    onUndefined: ADV,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: exerciseId,
  };
}

function n7CycleDays(
  cycle: Cycle
): readonly { readonly name: string; readonly slots: readonly SlotDef[] }[] {
  const ml = (exerciseId: string, phase: Phase, sets: number, reps: number): SlotDef =>
    n7Main(exerciseId, cycle, phase, sets, reps);

  return [
    // Block 1 — Week 1
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        ml('press_mil', 'b1', 5, 5),
        n7Acc('press_franc', 't2'),
        n7Acc('ext_polea', 't3'),
        n7Acc('elev_lat', 't3'),
        n7Acc('elev_post', 't3'),
      ],
    },
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        ml('deadlift', 'b1', 1, 5),
        n7Acc('remo_bar', 't2'),
        n7Acc('jalon', 't2'),
        n7Acc('face_pull', 't3'),
        n7Acc('gemelo_pie', 't3'),
        n7Acc('gemelo_sent', 't3'),
      ],
    },
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        ml('bench', 'b1', 5, 5),
        n7Acc('apert', 't2'),
        n7Acc('cruces', 't3'),
        n7Acc('curl_bar', 't2'),
        n7Acc('curl_alt', 't3'),
      ],
    },
    {
      name: 'Vie — Pierna',
      slots: [
        ml('squat', 'b1', 5, 5),
        n7Acc('prensa', 't2'),
        n7Acc('ext_quad', 't3'),
        n7Acc('curl_fem', 't3'),
        n7Acc('hip_thrust', 't2'),
      ],
    },
    // Block 1 — Week 2
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        ml('press_mil', 'b1', 5, 5),
        n7Acc('press_franc', 't2'),
        n7Acc('ext_polea', 't3'),
        n7Acc('elev_lat', 't3'),
        n7Acc('elev_front', 't3'),
      ],
    },
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        ml('deadlift', 'b1', 1, 5),
        n7Acc('remo_bar', 't2'),
        n7Acc('jalon', 't2'),
        n7Acc('face_pull', 't3'),
        n7Acc('gemelo_pie', 't3'),
        n7Acc('gemelo_sent', 't3'),
      ],
    },
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        ml('bench', 'b1', 5, 5),
        n7Acc('apert', 't2'),
        n7Acc('cruces', 't3'),
        n7Acc('curl_bar', 't2'),
        n7Acc('curl_mart', 't3'),
      ],
    },
    {
      name: 'Vie — Pierna',
      slots: [
        ml('squat', 'b1', 5, 5),
        n7Acc('prensa', 't2'),
        n7Acc('ext_quad', 't3'),
        n7Acc('curl_fem', 't3'),
        n7Acc('zancadas', 't2'),
      ],
    },
    // Block 1 — Week 3 (deload)
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        ml('press_mil', 'b1d', 5, 5),
        n7Acc('press_franc', 't2'),
        n7Acc('ext_polea', 't3'),
        n7Acc('elev_lat', 't3'),
        n7Acc('elev_post', 't3'),
      ],
    },
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        ml('deadlift', 'b1d', 1, 5),
        n7Acc('remo_bar', 't2'),
        n7Acc('jalon', 't2'),
        n7Acc('face_pull', 't3'),
        n7Acc('gemelo_pie', 't3'),
        n7Acc('gemelo_sent', 't3'),
      ],
    },
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        ml('bench', 'b1d', 5, 5),
        n7Acc('apert', 't2'),
        n7Acc('cruces', 't3'),
        n7Acc('curl_bar', 't2'),
        n7Acc('curl_alt', 't3'),
      ],
    },
    {
      name: 'Vie — Pierna',
      slots: [
        ml('squat', 'b1d', 5, 5),
        n7Acc('prensa', 't2'),
        n7Acc('ext_quad', 't3'),
        n7Acc('curl_fem', 't3'),
        n7Acc('leg_press_gem', 't3'),
      ],
    },
    // Block 2 — Week 4
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        ml('press_mil', 'b2', 3, 3),
        n7Acc('press_franc', 't2'),
        n7Acc('ext_polea', 't3'),
        n7Acc('elev_lat', 't3'),
        n7Acc('elev_post', 't3'),
      ],
    },
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        ml('deadlift', 'b2', 1, 3),
        n7Acc('remo_bar', 't2'),
        n7Acc('jalon', 't2'),
        n7Acc('face_pull', 't3'),
        n7Acc('gemelo_pie', 't3'),
        n7Acc('gemelo_sent', 't3'),
      ],
    },
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        ml('bench', 'b2', 3, 3),
        n7Acc('apert', 't2'),
        n7Acc('cruces', 't3'),
        n7Acc('curl_bar', 't2'),
        n7Acc('curl_alt', 't3'),
      ],
    },
    {
      name: 'Vie — Pierna',
      slots: [
        ml('squat', 'b2', 3, 3),
        n7Acc('prensa', 't2'),
        n7Acc('ext_quad', 't3'),
        n7Acc('curl_fem', 't3'),
        n7Acc('hip_thrust', 't2'),
      ],
    },
    // Block 2 — Week 5
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        ml('press_mil', 'b2', 3, 3),
        n7Acc('press_franc', 't2'),
        n7Acc('ext_polea', 't3'),
        n7Acc('elev_lat', 't3'),
        n7Acc('elev_front', 't3'),
      ],
    },
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        ml('deadlift', 'b2', 1, 3),
        n7Acc('remo_bar', 't2'),
        n7Acc('jalon', 't2'),
        n7Acc('face_pull', 't3'),
        n7Acc('gemelo_pie', 't3'),
        n7Acc('gemelo_sent', 't3'),
      ],
    },
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        ml('bench', 'b2', 3, 3),
        n7Acc('apert', 't2'),
        n7Acc('cruces', 't3'),
        n7Acc('curl_bar', 't2'),
        n7Acc('curl_mart', 't3'),
      ],
    },
    {
      name: 'Vie — Pierna',
      slots: [
        ml('squat', 'b2', 3, 3),
        n7Acc('prensa', 't2'),
        n7Acc('ext_quad', 't3'),
        n7Acc('curl_fem', 't3'),
        n7Acc('zancadas', 't2'),
      ],
    },
    // Block 2 — Week 6 (record)
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        ml('press_mil', 'b2', 3, 3),
        n7Acc('press_franc', 't2'),
        n7Acc('ext_polea', 't3'),
        n7Acc('elev_lat', 't3'),
        n7Acc('elev_post', 't3'),
      ],
    },
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        ml('deadlift', 'b2', 1, 3),
        n7Acc('remo_bar', 't2'),
        n7Acc('jalon', 't2'),
        n7Acc('face_pull', 't3'),
        n7Acc('gemelo_pie', 't3'),
        n7Acc('gemelo_sent', 't3'),
      ],
    },
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        ml('bench', 'b2', 3, 3),
        n7Acc('apert', 't2'),
        n7Acc('cruces', 't3'),
        n7Acc('curl_bar', 't2'),
        n7Acc('curl_alt', 't3'),
      ],
    },
    {
      name: 'Vie — Pierna',
      slots: [
        ml('squat', 'b2', 3, 3),
        n7Acc('prensa', 't2'),
        n7Acc('ext_quad', 't3'),
        n7Acc('curl_fem', 't3'),
        n7Acc('leg_press_gem', 't3'),
      ],
    },
  ];
}

const NIVEL7_DEFINITION_JSONB = {
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
    press_mil: {},
    bench: {},
    squat: {},
    deadlift: {},
    press_franc: {},
    ext_polea: {},
    elev_lat: {},
    elev_post: {},
    remo_bar: {},
    jalon: {},
    face_pull: {},
    gemelo_pie: {},
    gemelo_sent: {},
    apert: {},
    cruces: {},
    curl_bar: {},
    curl_alt: {},
    curl_mart: {},
    prensa: {},
    ext_quad: {},
    curl_fem: {},
    hip_thrust: {},
    zancadas: {},
    leg_press_gem: {},
    elev_front: {},
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
    { key: 'prensa', label: 'Prensa', type: 'weight', min: 0, step: 0.5, group: 'Pierna' },
    {
      key: 'ext_quad',
      label: 'Extensión Cuádriceps',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Pierna',
    },
    { key: 'curl_fem', label: 'Curl Femoral', type: 'weight', min: 0, step: 0.5, group: 'Pierna' },
    { key: 'hip_thrust', label: 'Hip Thrust', type: 'weight', min: 0, step: 0.5, group: 'Pierna' },
    { key: 'zancadas', label: 'Zancadas', type: 'weight', min: 0, step: 0.5, group: 'Pierna' },
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
  days: [...n7CycleDays('c1'), ...n7CycleDays('c2')],
};

// ---------------------------------------------------------------------------
// Seed function
// ---------------------------------------------------------------------------

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
