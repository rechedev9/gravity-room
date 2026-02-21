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
  }
}

/**
 * Interprets a ProgramDefinition and replays all workouts deterministically.
 *
 * @param definition - The program DSL describing days, slots, and progression rules.
 * @param config     - Start weights keyed by slot.startWeightKey (e.g. { squat: 60 }).
 * @param results    - Recorded results keyed by workout index string, then by slot id.
 * @returns          - One GenericWorkoutRow per workout (length === definition.totalWorkouts).
 */
export function computeGenericProgram(
  definition: ProgramDefinition,
  config: Record<string, number>,
  results: GenericResults
): GenericWorkoutRow[] {
  // --- Initialization: one state entry per unique slot id ---
  const slotState: Record<string, SlotState> = {};
  for (const day of definition.days) {
    for (const slot of day.slots) {
      if (!(slot.id in slotState)) {
        const base = config[slot.startWeightKey] ?? 0;
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

  const rows: GenericWorkoutRow[] = [];
  const cycleLength = definition.days.length;

  for (let i = 0; i < definition.totalWorkouts; i++) {
    const day = definition.days[i % cycleLength];
    const workoutResult = results[String(i)] ?? {};

    // --- 1. Snapshot BEFORE applying progression ---
    const slots: GenericSlotRow[] = day.slots.map((slot) => {
      const state = slotState[slot.id];
      const stageConfig = slot.stages[state.stage];
      const slotResult = workoutResult[slot.id] ?? {};
      const exerciseName = definition.exercises[slot.exerciseId].name;

      return {
        slotId: slot.id,
        exerciseId: slot.exerciseId,
        exerciseName,
        tier: slot.tier,
        weight: state.weight,
        stage: state.stage,
        sets: stageConfig.sets,
        reps: stageConfig.reps,
        isAmrap: stageConfig.amrap === true,
        result: slotResult.result,
        amrapReps: slotResult.amrapReps,
        isChanged: state.everChanged,
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
      const maxStageIdx = slot.stages.length - 1;
      const increment = definition.weightIncrements[slot.exerciseId] ?? 0;

      if (resultValue === 'fail') {
        const rule = state.stage >= maxStageIdx ? slot.onFinalStageFail : slot.onMidStageFail;
        const changesState = rule.type !== 'no_change';
        const nextState = applyRule(rule, state, increment, maxStageIdx);
        slotState[slot.id] = { ...nextState, everChanged: state.everChanged || changesState };
      } else if (resultValue === 'success') {
        const nextState = applyRule(slot.onSuccess, state, increment, maxStageIdx);
        slotState[slot.id] = { ...nextState, everChanged: state.everChanged };
      } else {
        // undefined — apply onUndefined if set, else onSuccess (implicit pass)
        const rule = slot.onUndefined ?? slot.onSuccess;
        const nextState = applyRule(rule, state, increment, maxStageIdx);
        slotState[slot.id] = { ...nextState, everChanged: state.everChanged };
      }
    }
  }

  return rows;
}
