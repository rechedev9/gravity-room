// Shared types, constants, and helpers for program template seeds.

/** A single set prescription (percentage-based loading). */
export interface SetPrescription {
  readonly percent: number;
  readonly reps: number;
  readonly sets: number;
}

export interface SlotDef {
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
  readonly notes?: string;
  /** Percentage-based set prescriptions (replaces stages for %1RM programs). */
  readonly prescriptions?: readonly SetPrescription[];
  /** Config key for the 1RM to derive weights from (e.g., 'squat1rm'). */
  readonly percentOf?: string;
  /** True for GPP slots where the athlete picks their own weight. */
  readonly isGpp?: boolean;
  /** Complex rep scheme display string (e.g., '1+3'). */
  readonly complexReps?: string;
  /** Config key to update with the user's test weight. */
  readonly propagatesTo?: string;
  /** True for test/max-effort slots that require weight entry. */
  readonly isTestSlot?: boolean;
  /** True for bodyweight exercises where the weight column should be hidden. */
  readonly isBodyweight?: boolean;
}

export const NC = { type: 'no_change' } as const;
export const ADV = { type: 'advance_stage' } as const;

/** Generic TM-percentage slot (used by BBB, 5/3/1 Beginners, and other 5/3/1 variants). */
export function tmSlot(
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

/** Generic TM-percentage top set (primary slot with optional TM auto-update). */
export function tmTopSlot(
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

/** Shared config strings for 5/3/1 variants that use a Training Max. */
export const TM_CONFIG_STRINGS = {
  configTitle: 'Training Max (kg)',
  configDescription:
    'Introduce tu Training Max para cada levantamiento principal. ' +
    'Se recomienda usar el 90% de tu 1RM.',
  configEditTitle: 'Editar Training Max (kg)',
  configEditDescription:
    'Actualiza tu Training Max — el programa se recalculará con los nuevos valores.',
} as const;

/** Shared config fields for the 4 main barbell TMs (squat, bench, deadlift, OHP). */
export const TM_CONFIG_FIELDS = [
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
] as const;

// --- Sheiko config ---

/** Sheiko 1RM config strings. */
export const SHEIKO_1RM_CONFIG_STRINGS = {
  configTitle: '1RM de Competicion (kg)',
  configDescription:
    'Introduce tu 1RM REAL para cada levantamiento de competicion. ' +
    'Usa tu mejor marca reciente, no tu maximo deseado.',
  configEditTitle: 'Editar 1RM de Competicion (kg)',
  configEditDescription:
    'Actualiza tu 1RM — los pesos del programa se recalcularan automaticamente.',
} as const;

/** Rounding select config field shared by all Sheiko programs. */
const SHEIKO_ROUNDING_FIELD = {
  key: 'rounding',
  label: 'Redondeo de pesos',
  type: 'select',
  options: [
    { label: '2.5 kg', value: '2.5' },
    { label: '1.25 kg', value: '1.25' },
  ],
  group: 'Configuracion',
} as const;

/** Sheiko config fields: squat1rm, bench1rm, deadlift1rm, rounding. */
export const SHEIKO_1RM_CONFIG_FIELDS = [
  {
    key: 'squat1rm',
    label: 'Sentadilla 1RM (kg)',
    type: 'weight',
    min: 20,
    step: 2.5,
    group: '1RM de Competicion',
  },
  {
    key: 'bench1rm',
    label: 'Press Banca 1RM (kg)',
    type: 'weight',
    min: 20,
    step: 2.5,
    group: '1RM de Competicion',
  },
  {
    key: 'deadlift1rm',
    label: 'Peso Muerto 1RM (kg)',
    type: 'weight',
    min: 20,
    step: 2.5,
    group: '1RM de Competicion',
  },
  SHEIKO_ROUNDING_FIELD,
] as const;

/** Sheiko bench-only config fields: bench1rm + rounding. */
export const SHEIKO_BENCH_ONLY_CONFIG_FIELDS = [
  {
    key: 'bench1rm',
    label: 'Press Banca 1RM (kg)',
    type: 'weight',
    min: 20,
    step: 2.5,
    group: '1RM de Competicion',
  },
  SHEIKO_ROUNDING_FIELD,
] as const;

/** Create a competition lift slot with percentage prescriptions. */
export function prescriptionSlot(
  id: string,
  exerciseId: string,
  percentOf: string,
  prescriptions: readonly SetPrescription[],
  complexReps?: string
): SlotDef {
  return {
    id,
    exerciseId,
    tier: 'comp',
    role: 'primary',
    percentOf,
    prescriptions,
    complexReps,
    stages: [{ sets: 1, reps: 1 }],
    onSuccess: NC,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: percentOf,
  };
}

/** Create a GPP/accessory slot (no weight, pass/fail tracking). */
export function gppSlot(id: string, exerciseId: string, reps: number, sets: number): SlotDef {
  return {
    id,
    exerciseId,
    tier: 'gpp',
    role: 'accessory',
    isGpp: true,
    stages: [{ sets, reps }],
    onSuccess: NC,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: '__gpp',
  };
}

// ═══════════════════════════════════════════════════════════════════════
// BRUNETTI HELPERS — shared across brunetti-365.ts, sala-1/2/3.ts
// ═══════════════════════════════════════════════════════════════════════

/** A single workout day with a name and ordered list of exercise slots. */
export type ProgramDay = { readonly name: string; readonly slots: readonly SlotDef[] };

/** TM key constants for the three main Brunetti lifts. */
export const BRUNETTI_TM = {
  SQUAT: 'squat_tm',
  BENCH: 'bench_tm',
  DEADLIFT: 'deadlift_tm',
} as const;

/** JAW block-specific TM key constants (3 blocks × 3 lifts = 9 keys). */
export const BRUNETTI_JAW_TM = {
  B1: { SQUAT: 'squat_jaw_b1_tm', BENCH: 'bench_jaw_b1_tm', DEADLIFT: 'deadlift_jaw_b1_tm' },
  B2: { SQUAT: 'squat_jaw_b2_tm', BENCH: 'bench_jaw_b2_tm', DEADLIFT: 'deadlift_jaw_b2_tm' },
  B3: { SQUAT: 'squat_jaw_b3_tm', BENCH: 'bench_jaw_b3_tm', DEADLIFT: 'deadlift_jaw_b3_tm' },
} as const;

/** Union of all Brunetti TM key string literals. */
export type BrunettiTmKeys =
  | (typeof BRUNETTI_TM)[keyof typeof BRUNETTI_TM]
  | (typeof BRUNETTI_JAW_TM)['B1'][keyof (typeof BRUNETTI_JAW_TM)['B1']]
  | (typeof BRUNETTI_JAW_TM)['B2'][keyof (typeof BRUNETTI_JAW_TM)['B2']]
  | (typeof BRUNETTI_JAW_TM)['B3'][keyof (typeof BRUNETTI_JAW_TM)['B3']];

/** Create a TM-based slot with no_change progression (Brunetti programs). */
export function tmNcSlot(
  id: string,
  exerciseId: string,
  tmKey: string,
  pct: number,
  sets: number,
  reps: number,
  tier: string = 'main',
  notes?: string
): SlotDef {
  return {
    id,
    exerciseId,
    tier,
    role: tier === 'main' ? 'primary' : 'secondary',
    trainingMaxKey: tmKey,
    tmPercent: pct,
    stages: [{ sets, reps }],
    onSuccess: NC,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: tmKey,
    ...(notes !== undefined ? { notes } : {}),
  };
}

/** Create a flat (absolute weight) slot with no_change progression. */
export function flatNcSlot(
  id: string,
  exerciseId: string,
  startWeightKey: string,
  sets: number,
  reps: number,
  tier: string = 'accessory',
  notes?: string
): SlotDef {
  return {
    id,
    exerciseId,
    tier,
    role: 'accessory',
    stages: [{ sets, reps }],
    onSuccess: NC,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey,
    ...(notes !== undefined ? { notes } : {}),
  };
}

/** Create a max-test slot with instructional notes. */
export function maxTestSlot(
  id: string,
  exerciseId: string,
  startWeightKey: string,
  liftName: string,
  blockNum: number,
  nextBlockTmLabel: string,
  propagatesTo?: string
): SlotDef {
  return {
    id,
    exerciseId,
    tier: 'main',
    role: 'primary',
    stages: [{ sets: 1, reps: 1 }],
    onSuccess: NC,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey,
    isTestSlot: true,
    ...(propagatesTo !== undefined ? { propagatesTo } : {}),
    notes:
      `TEST DE 1RM — ${liftName.toUpperCase()}. ` +
      'Calienta progresivamente hasta tu maximo. ' +
      (blockNum < 3
        ? `Despues, ve a "Editar configuracion" y actualiza ` +
          `"${nextBlockTmLabel}" con tu nuevo maximo.`
        : 'Registra tu resultado. Este es tu maximo final del protocolo JAW.'),
  };
}
