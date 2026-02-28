import type { ProgramDefinition, GenericResults } from './types/program';
import type { GenericSlotRow, GenericWorkoutRow, ResultValue } from './types/index';

export function roundToNearestHalf(value: number): number {
  const rounded = Math.round(value * 2) / 2;
  if (!Number.isFinite(rounded) || rounded < 0) return 0;
  return rounded;
}

// Derived from ProgramDefinition so it automatically includes all rule variants
type ProgressionRule = ProgramDefinition['days'][number]['slots'][number]['onSuccess'];

interface SlotState {
  weight: number;
  stage: number;
  everChanged: boolean;
}

function applyRule(
  rule: ProgressionRule,
  state: SlotState,
  increment: number,
  maxStageIdx: number
): SlotState {
  switch (rule.type) {
    case 'add_weight':
      return { ...state, weight: state.weight + increment };
    case 'advance_stage':
      return { ...state, stage: Math.min(state.stage + 1, maxStageIdx) };
    case 'advance_stage_add_weight':
      return {
        ...state,
        stage: Math.min(state.stage + 1, maxStageIdx),
        weight: state.weight + increment,
      };
    case 'deload_percent':
      return {
        ...state,
        weight: roundToNearestHalf(state.weight * (1 - rule.percent / 100)),
        stage: 0,
      };
    case 'add_weight_reset_stage':
      return {
        ...state,
        weight: roundToNearestHalf(state.weight + rule.amount),
        stage: 0,
      };
    case 'no_change':
      return { ...state };
    case 'update_tm':
      // update_tm is handled inline in the progression loop (needs tmState access).
      // If reached here (defensive), treat as no-op for slotState.
      return { ...state };
  }
}

type Role = 'primary' | 'secondary' | 'accessory' | undefined;

/** Tier-to-role inference map for legacy programs (GZCLP, Nivel7). */
const TIER_ROLE_MAP: Record<string, 'primary' | 'secondary' | 'accessory'> = {
  t1: 'primary',
  t2: 'secondary',
  t3: 'primary',
};

function resolveRole(
  explicitRole: 'primary' | 'secondary' | 'accessory' | undefined,
  tier: string
): Role {
  if (explicitRole !== undefined) return explicitRole;
  return TIER_ROLE_MAP[tier];
}

type UpdateTmRule = {
  readonly type: 'update_tm';
  readonly amount: number;
  readonly minAmrapReps: number;
};
type SlotDef = ProgramDefinition['days'][number]['slots'][number];
type SlotResult = { result?: 'success' | 'fail'; amrapReps?: number; rpe?: number };

function applyUpdateTm(
  rule: UpdateTmRule,
  slot: SlotDef,
  slotResult: SlotResult,
  tmState: Record<string, number>,
  slotState: Record<string, SlotState>,
  state: SlotState
): void {
  if (slot.trainingMaxKey === undefined) {
    throw new Error('update_tm rule requires trainingMaxKey on slot');
  }
  const amrapReps = slotResult.amrapReps;
  if (amrapReps !== undefined && amrapReps >= rule.minAmrapReps) {
    tmState[slot.trainingMaxKey] = roundToNearestHalf(tmState[slot.trainingMaxKey] + rule.amount);
    slotState[slot.id] = { ...state, everChanged: true };
  } else {
    slotState[slot.id] = { ...state, everChanged: state.everChanged };
  }
}

/** Selects the applicable rule and applies progression for a single slot. */
function applySlotProgression(
  slot: SlotDef,
  state: SlotState,
  slotResult: SlotResult,
  resultValue: ResultValue | undefined,
  increment: number,
  tmState: Record<string, number>,
  slotState: Record<string, SlotState>
): void {
  const maxStageIdx = slot.stages.length - 1;

  if (resultValue === 'fail') {
    const rule = state.stage >= maxStageIdx ? slot.onFinalStageFail : slot.onMidStageFail;
    if (rule.type === 'update_tm') {
      applyUpdateTm(rule, slot, slotResult, tmState, slotState, state);
      return;
    }
    const changesState = rule.type !== 'no_change';
    const nextState = applyRule(rule, state, increment, maxStageIdx);
    slotState[slot.id] = { ...nextState, everChanged: state.everChanged || changesState };
    return;
  }

  if (resultValue === 'success') {
    const rule =
      state.stage >= maxStageIdx && slot.onFinalStageSuccess
        ? slot.onFinalStageSuccess
        : slot.onSuccess;
    if (rule.type === 'update_tm') {
      applyUpdateTm(rule, slot, slotResult, tmState, slotState, state);
      return;
    }
    const nextState = applyRule(rule, state, increment, maxStageIdx);
    slotState[slot.id] = { ...nextState, everChanged: state.everChanged };
    return;
  }

  // undefined — apply onUndefined if set, else onSuccess (implicit pass)
  const rule = slot.onUndefined ?? slot.onSuccess;
  if (rule.type === 'update_tm') {
    applyUpdateTm(rule, slot, slotResult, tmState, slotState, state);
    return;
  }
  const nextState = applyRule(rule, state, increment, maxStageIdx);
  slotState[slot.id] = { ...nextState, everChanged: state.everChanged };
}

/**
 * Interprets a ProgramDefinition and replays all workouts deterministically.
 *
 * @param definition - The program DSL describing days, slots, and progression rules.
 * @param config     - Start weights keyed by slot.startWeightKey (e.g. { squat: 60 }).
 * @param results    - Recorded results keyed by workout index string, then by slot id.
 * @returns          - One GenericWorkoutRow per workout (length === definition.totalWorkouts).
 */
/** Extract a numeric value from config, returning 0 for non-numeric/missing entries. */
function configToNum(config: Record<string, number | string>, key: string): number {
  const v = config[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export function computeGenericProgram(
  definition: ProgramDefinition,
  config: Record<string, number | string>,
  results: GenericResults
): GenericWorkoutRow[] {
  // --- Initialization: one state entry per unique slot id ---
  const slotState: Record<string, SlotState> = {};
  for (const day of definition.days) {
    for (const slot of day.slots) {
      if (!(slot.id in slotState)) {
        const base = configToNum(config, slot.startWeightKey);
        const multiplied =
          slot.startWeightMultiplier !== undefined
            ? roundToNearestHalf(base * slot.startWeightMultiplier)
            : base;
        const offset = slot.startWeightOffset ?? 0;
        const increment = definition.weightIncrements[slot.exerciseId] ?? 0;
        const weight = roundToNearestHalf(multiplied - offset * increment);
        slotState[slot.id] = { weight, stage: 0, everChanged: false };
      }
    }
  }

  // --- TM initialization: one entry per unique trainingMaxKey ---
  const tmState: Record<string, number> = {};
  for (const day of definition.days) {
    for (const slot of day.slots) {
      if (slot.trainingMaxKey !== undefined && !(slot.trainingMaxKey in tmState)) {
        tmState[slot.trainingMaxKey] = configToNum(config, slot.trainingMaxKey);
      }
    }
  }

  const rows: GenericWorkoutRow[] = [];
  const cycleLength = definition.days.length;
  const prevWeightByExerciseId = new Map<string, number>();

  for (let i = 0; i < definition.totalWorkouts; i++) {
    const day = definition.days[i % cycleLength];
    const workoutResult = results[String(i)] ?? {};

    // --- 1. Snapshot BEFORE applying progression ---
    const slots: GenericSlotRow[] = day.slots.map((slot) => {
      const state = slotState[slot.id];
      const stageConfig = slot.stages[state.stage];
      const slotResult = workoutResult[slot.id] ?? {};
      const exerciseName = definition.exercises[slot.exerciseId].name;

      // TM-derived weight or absolute weight
      const weight =
        slot.trainingMaxKey !== undefined && slot.tmPercent !== undefined
          ? roundToNearestHalf(tmState[slot.trainingMaxKey] * slot.tmPercent)
          : state.weight;

      // Deload detection: weight decreased vs previous occurrence of same exercise
      const prevWeight = prevWeightByExerciseId.get(slot.exerciseId);
      const isDeload = prevWeight !== undefined && weight > 0 && weight < prevWeight;
      if (weight > 0) {
        prevWeightByExerciseId.set(slot.exerciseId, weight);
      }

      // Role resolution: explicit > infer from tier > undefined
      const role = resolveRole(slot.role, slot.tier);

      return {
        slotId: slot.id,
        exerciseId: slot.exerciseId,
        exerciseName,
        tier: slot.tier,
        weight,
        stage: state.stage,
        sets: stageConfig.sets,
        reps: stageConfig.reps,
        repsMax: stageConfig.repsMax,
        isAmrap: stageConfig.amrap === true,
        stagesCount: slot.stages.length,
        result: slotResult.result,
        amrapReps: slotResult.amrapReps,
        rpe: slotResult.rpe,
        isChanged: state.everChanged,
        isDeload,
        role,
        notes: slot.notes,
      };
    });

    rows.push({
      index: i,
      dayName: day.name,
      slots,
      isChanged: slots.some((s) => s.isChanged),
    });

    // --- 2. Apply progression AFTER snapshot ---
    for (const slot of day.slots) {
      const state = slotState[slot.id];
      const slotResult = workoutResult[slot.id] ?? {};
      const resultValue: ResultValue | undefined = slotResult.result;
      const increment = definition.weightIncrements[slot.exerciseId] ?? 0;
      applySlotProgression(slot, state, slotResult, resultValue, increment, tmState, slotState);
    }
  }

  return rows;
}
