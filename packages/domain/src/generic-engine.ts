import type { ProgramDefinition, GenericResults } from './types/program';
import type {
  GenericSlotRow,
  GenericWorkoutRow,
  ResolvedPrescription,
  ResultValue,
  SetLogEntry,
} from './types';

function roundToNearestHalf(value: number): number {
  const rounded = Math.round(value * 2) / 2;
  if (!Number.isFinite(rounded) || rounded < 0) return 0;
  return rounded;
}

/** Round a value to the nearest multiple of `step`. */
export function roundToNearest(value: number, step: number): number {
  if (step <= 0 || !Number.isFinite(step)) return roundToNearestHalf(value);
  const rounded = Math.round(value / step) * step;
  if (!Number.isFinite(rounded) || rounded < 0) return 0;
  // Avoid floating-point artifacts (e.g., 67.49999... -> 67.5)
  return Math.round(rounded * 1000) / 1000;
}

interface DoubleProgressionParams {
  readonly type: 'double_progression';
  readonly repRangeTop: number;
  readonly repRangeBottom: number;
}

function requireValue<T>(value: T | undefined, message: string): T {
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

export function deriveResultFromSetLogs(
  setLogs: readonly SetLogEntry[] | undefined,
  rule: DoubleProgressionParams
): ResultValue | undefined {
  if (setLogs === undefined || setLogs.length === 0) return undefined;

  if (setLogs.every((s) => s.reps >= rule.repRangeTop)) return 'success';
  if (setLogs.some((s) => s.reps < rule.repRangeBottom)) return 'fail';

  return undefined;
}

export function deriveResultFromSetLogsSimple(
  setLogs: readonly SetLogEntry[] | undefined,
  targetReps: number
): ResultValue | undefined {
  if (setLogs === undefined || setLogs.length === 0) return undefined;

  if (setLogs.every((s) => s.reps >= targetReps)) return 'success';

  return 'fail';
}

function deriveSlotResult(
  slot: SlotDef,
  slotResult: SlotResult,
  targetReps: number
): ResultValue | undefined {
  if (slotResult.setLogs === undefined || slotResult.setLogs.length === 0) {
    return slotResult.result;
  }

  const idx = slot.progressionSetIndex;
  const selectedLog =
    idx !== undefined && idx < slotResult.setLogs.length ? slotResult.setLogs[idx] : undefined;
  const logs = selectedLog !== undefined ? [selectedLog] : slotResult.setLogs;

  if (slot.onSuccess.type === 'double_progression') {
    const derived = deriveResultFromSetLogs(logs, slot.onSuccess);
    return derived ?? slotResult.result;
  }
  const derived = deriveResultFromSetLogsSimple(logs, targetReps);
  return derived ?? slotResult.result;
}

type ProgressionRule = ProgramDefinition['days'][number]['slots'][number]['onSuccess'];

interface SlotState {
  weight: number;
  stage: number;
  everChanged: boolean;
}

const TIER_ROLE_MAP: Record<string, 'primary' | 'secondary' | 'accessory'> = {
  t1: 'primary',
  t2: 'secondary',
  t3: 'primary',
};

type Role = 'primary' | 'secondary' | 'accessory' | undefined;

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

type SlotResult = {
  result?: 'success' | 'fail' | undefined;
  amrapReps?: number | undefined;
  rpe?: number | undefined;
  setLogs?: readonly SetLogEntry[] | undefined;
};

function toSlotResult(value: GenericResults[string][string] | undefined): SlotResult {
  return value ?? {};
}

function applyRule(
  rule: ProgressionRule,
  state: SlotState,
  increment: number,
  maxStageIdx: number,
  roundingStep: number
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
        weight: roundToNearest(state.weight * (1 - rule.percent / 100), roundingStep),
        stage: 0,
      };
    case 'add_weight_reset_stage':
      return {
        ...state,
        weight: roundToNearest(state.weight + rule.amount, roundingStep),
        stage: 0,
      };
    case 'no_change':
      return { ...state };
    case 'update_tm':
      return { ...state };
    case 'double_progression':
      return { ...state, weight: state.weight + increment };
  }

  return state;
}

function applyUpdateTm(
  rule: UpdateTmRule,
  slot: SlotDef,
  slotResult: SlotResult,
  tmState: Record<string, number>,
  slotState: Record<string, SlotState>,
  state: SlotState,
  roundingStep: number
): void {
  if (slot.trainingMaxKey === undefined) {
    throw new Error('update_tm rule requires trainingMaxKey on slot');
  }
  const amrapReps = slotResult.amrapReps;
  const currentTm = tmState[slot.trainingMaxKey] ?? 0;
  if (amrapReps !== undefined && amrapReps >= rule.minAmrapReps) {
    tmState[slot.trainingMaxKey] = roundToNearest(currentTm + rule.amount, roundingStep);
    slotState[slot.id] = { ...state, everChanged: true };
  } else {
    slotState[slot.id] = { ...state, everChanged: state.everChanged };
  }
}

function applySlotProgression(
  slot: SlotDef,
  state: SlotState,
  slotResult: SlotResult,
  resultValue: ResultValue | undefined,
  increment: number,
  tmState: Record<string, number>,
  slotState: Record<string, SlotState>,
  roundingStep: number
): void {
  const maxStageIdx = slot.stages.length - 1;

  if (resultValue === 'fail') {
    const rule = state.stage >= maxStageIdx ? slot.onFinalStageFail : slot.onMidStageFail;
    if (rule.type === 'update_tm') {
      applyUpdateTm(rule, slot, slotResult, tmState, slotState, state, roundingStep);
      return;
    }
    const changesState = rule.type !== 'no_change';
    const nextState = applyRule(rule, state, increment, maxStageIdx, roundingStep);
    slotState[slot.id] = { ...nextState, everChanged: state.everChanged || changesState };
    return;
  }

  if (resultValue === 'success') {
    const rule =
      state.stage >= maxStageIdx && slot.onFinalStageSuccess
        ? slot.onFinalStageSuccess
        : slot.onSuccess;
    if (rule.type === 'update_tm') {
      applyUpdateTm(rule, slot, slotResult, tmState, slotState, state, roundingStep);
      return;
    }
    const nextState = applyRule(rule, state, increment, maxStageIdx, roundingStep);
    slotState[slot.id] = { ...nextState, everChanged: state.everChanged };
    return;
  }

  const rule = slot.onUndefined ?? slot.onSuccess;
  if (rule.type === 'update_tm') {
    applyUpdateTm(rule, slot, slotResult, tmState, slotState, state, roundingStep);
    return;
  }
  const nextState = applyRule(rule, state, increment, maxStageIdx, roundingStep);
  slotState[slot.id] = { ...nextState, everChanged: state.everChanged };
}

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
  const DEFAULT_ROUNDING_STEP = 2.5;
  const roundingStep = configToNum(config, 'rounding') || DEFAULT_ROUNDING_STEP;

  const slotState: Record<string, SlotState> = {};
  for (const day of definition.days) {
    for (const slot of day.slots) {
      if (!(slot.id in slotState)) {
        const base = configToNum(config, slot.startWeightKey);
        const multiplied =
          slot.startWeightMultiplier !== undefined
            ? roundToNearest(base * slot.startWeightMultiplier, roundingStep)
            : base;
        const offset = slot.startWeightOffset ?? 0;
        const increment = definition.weightIncrements[slot.exerciseId] ?? 0;
        const weight = roundToNearest(multiplied - offset * increment, roundingStep);
        slotState[slot.id] = { weight, stage: 0, everChanged: false };
      }
    }
  }

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
    const day = requireValue(definition.days[i % cycleLength], `Missing day for workout ${i}`);
    const workoutResult = results[String(i)] ?? {};
    const derivedResultsBySlotId: Record<string, ResultValue | undefined> = {};

    const slots: GenericSlotRow[] = day.slots.map((slot) => {
      const state = requireValue(slotState[slot.id], `Missing slot state for ${slot.id}`);
      const slotResult = toSlotResult(workoutResult[slot.id]);
      const exercise = requireValue(
        definition.exercises[slot.exerciseId],
        `Missing exercise definition for ${slot.exerciseId}`
      );
      const exerciseName = exercise.name;
      const role = resolveRole(slot.role, slot.tier);

      if (slot.prescriptions !== undefined && slot.percentOf !== undefined) {
        const base1rm = configToNum(config, slot.percentOf);

        const resolvedPrescriptions: ResolvedPrescription[] = slot.prescriptions.map((p) => ({
          percent: p.percent,
          reps: p.reps,
          sets: p.sets,
          weight: roundToNearest((base1rm * p.percent) / 100, roundingStep),
        }));

        const workingSet = requireValue(
          resolvedPrescriptions[resolvedPrescriptions.length - 1],
          `Missing working set for ${slot.id}`
        );

        return {
          slotId: slot.id,
          exerciseId: slot.exerciseId,
          exerciseName,
          tier: slot.tier,
          weight: workingSet.weight,
          stage: 0,
          sets: workingSet.sets,
          reps: workingSet.reps,
          repsMax: undefined,
          isAmrap: false,
          stagesCount: 1,
          result: slotResult.result,
          amrapReps: undefined,
          rpe: undefined,
          isChanged: false,
          isDeload: false,
          role,
          notes: slot.notes,
          prescriptions: resolvedPrescriptions,
          isGpp: slot.isGpp ?? false,
          complexReps: slot.complexReps,
          propagatesTo: slot.propagatesTo,
          isTestSlot: slot.isTestSlot,
          isBodyweight: slot.isBodyweight,
          setLogs: slotResult.setLogs,
        };
      }

      if (slot.isGpp === true) {
        const gppStage = requireValue(slot.stages[0], `Missing GPP stage for ${slot.id}`);
        return {
          slotId: slot.id,
          exerciseId: slot.exerciseId,
          exerciseName,
          tier: slot.tier,
          weight: 0,
          stage: 0,
          sets: gppStage.sets,
          reps: gppStage.reps,
          repsMax: undefined,
          isAmrap: false,
          stagesCount: 1,
          result: slotResult.result,
          amrapReps: undefined,
          rpe: undefined,
          isChanged: false,
          isDeload: false,
          role,
          notes: slot.notes,
          prescriptions: undefined,
          isGpp: true,
          complexReps: slot.complexReps,
          propagatesTo: slot.propagatesTo,
          isTestSlot: slot.isTestSlot,
          isBodyweight: slot.isBodyweight,
          setLogs: slotResult.setLogs,
        };
      }

      const stageConfig = requireValue(
        slot.stages[state.stage],
        `Missing stage ${state.stage} for ${slot.id}`
      );

      const weight =
        slot.trainingMaxKey !== undefined && slot.tmPercent !== undefined
          ? roundToNearest((tmState[slot.trainingMaxKey] ?? 0) * slot.tmPercent, roundingStep)
          : state.weight;

      const prevWeight = prevWeightByExerciseId.get(slot.exerciseId);
      const isDeload = prevWeight !== undefined && weight > 0 && weight < prevWeight;
      if (weight > 0) {
        prevWeightByExerciseId.set(slot.exerciseId, weight);
      }

      const derivedResult = deriveSlotResult(slot, slotResult, stageConfig.reps);
      derivedResultsBySlotId[slot.id] = derivedResult;

      const amrapReps =
        stageConfig.amrap === true &&
        slotResult.setLogs !== undefined &&
        slotResult.setLogs.length > 0
          ? requireValue(
              slotResult.setLogs[slotResult.setLogs.length - 1],
              `Missing set log for ${slot.id}`
            ).reps
          : slotResult.amrapReps;

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
        result: derivedResult,
        amrapReps,
        rpe: slotResult.rpe,
        isChanged: state.everChanged,
        isDeload,
        role,
        notes: slot.notes,
        prescriptions: undefined,
        isGpp: undefined,
        complexReps: undefined,
        propagatesTo: slot.propagatesTo,
        isTestSlot: slot.isTestSlot,
        isBodyweight: slot.isBodyweight,
        setLogs: slotResult.setLogs,
      };
    });

    rows.push({
      index: i,
      dayName: day.name,
      slots,
      isChanged: slots.some((s) => s.isChanged),
      completedAt: undefined,
    });

    for (const slot of day.slots) {
      if (slot.prescriptions !== undefined || slot.isGpp === true) continue;

      const state = requireValue(slotState[slot.id], `Missing slot state for ${slot.id}`);
      const slotResult = toSlotResult(workoutResult[slot.id]);
      const resultValue = derivedResultsBySlotId[slot.id];
      const increment = definition.weightIncrements[slot.exerciseId] ?? 0;
      applySlotProgression(
        slot,
        state,
        slotResult,
        resultValue,
        increment,
        tmState,
        slotState,
        roundingStep
      );
    }
  }

  return rows;
}
