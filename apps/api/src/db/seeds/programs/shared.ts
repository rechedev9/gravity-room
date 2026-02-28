// Shared types, constants, and helpers for program template seeds.

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
