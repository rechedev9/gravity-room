import type { ProgramDefinition } from '@gzclp/domain/types/program';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Human-readable stage description. */
interface StageInfo {
  readonly label: string;
  readonly amrap: boolean;
}

/** Describes one exercise slot's progression behavior in human-readable form. */
export interface SlotProgressionInfo {
  readonly exerciseName: string;
  readonly tier: string;
  readonly stages: readonly StageInfo[];
  readonly onSuccessText: string;
  readonly onFailText: string;
  readonly role?: string;
  readonly notes?: string;
  readonly isBodyweight?: boolean;
}

/** One day's breakdown for the overview. */
export interface DaySummary {
  readonly name: string;
  readonly exercises: readonly SlotSummary[];
}

/** A slot within a day summary. */
export interface SlotSummary {
  readonly exerciseName: string;
  readonly tier: string;
  readonly setsXReps: string;
  readonly role?: string;
}

/** Config field summary for the "what you need to configure" section. */
export interface ConfigFieldSummary {
  readonly label: string;
  readonly type: 'weight' | 'select';
  readonly group?: string;
  readonly hint?: string;
}

/** Unique exercise entry with its tier and optional role. */
interface UniqueExercise {
  readonly name: string;
  readonly tier: string;
  readonly role: string | undefined;
}

/** Progression rule entry with trigger context and description. */
interface ProgressionRuleEntry {
  readonly trigger: string;
  readonly description: string;
}

/** The full structured summary produced by buildProgramSummary. */
export interface ProgramSummary {
  readonly totalWorkouts: number;
  readonly workoutsPerWeek: number;
  readonly cycleLength: number;
  readonly uniqueExerciseCount: number;
  readonly uniqueExercises: readonly UniqueExercise[];
  readonly days: readonly DaySummary[];
  readonly progressionRules: readonly ProgressionRuleEntry[];
  readonly progressionInfo: readonly SlotProgressionInfo[];
  readonly configFields: readonly ConfigFieldSummary[];
  readonly configFieldCount: number;
  readonly hasTiers: boolean;
  readonly tierList: readonly string[];
  readonly hasStages: boolean;
  readonly stageCount: number;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type ProgressionRule = ProgramDefinition['days'][number]['slots'][number]['onSuccess'];

function formatSetsXReps(sets: number, reps: number, amrap?: boolean): string {
  return `${sets}x${reps}${amrap === true ? '+' : ''}`;
}

/** Maps a progression rule to a Spanish description string. */
function describeRule(rule: ProgressionRule): string {
  switch (rule.type) {
    case 'add_weight':
      return 'Sube peso en el siguiente entrenamiento';
    case 'deload_percent':
      return `Descarga al ${rule.percent}% del peso actual`;
    case 'advance_stage':
      return 'Pasa a la siguiente etapa (menos reps, más series)';
    case 'add_weight_reset_stage':
      return `Sube ${rule.amount} kg y vuelve a la primera etapa`;
    case 'no_change':
      return 'Mantiene el peso actual';
    case 'advance_stage_add_weight':
      return 'Sube peso y pasa de etapa';
    case 'update_tm':
      return `Actualiza el training max en ${rule.amount} kg`;
    case 'double_progression':
      return `Sube reps (${rule.repRangeBottom}-${rule.repRangeTop}); al tope, sube peso`;
  }

  return '';
}

/** Maps a progression rule to its trigger context string. */
function describeTrigger(rule: ProgressionRule): string {
  switch (rule.type) {
    case 'add_weight':
    case 'double_progression':
    case 'advance_stage_add_weight':
      return 'Completar todas las series';
    case 'advance_stage':
      return 'Fallar a mitad del programa';
    case 'deload_percent':
      return 'Fallar en la última etapa';
    case 'add_weight_reset_stage':
      return 'Completar la última etapa';
    case 'no_change':
      return 'Resultado indefinido';
    case 'update_tm':
      return `Serie AMRAP >= ${rule.minAmrapReps} reps`;
  }

  return '';
}

type SlotShape = ProgramDefinition['days'][number]['slots'][number];

/** Collects all progression rules from a slot into a flat array. */
function collectSlotRules(slot: SlotShape): readonly ProgressionRule[] {
  const rules: ProgressionRule[] = [slot.onSuccess, slot.onMidStageFail, slot.onFinalStageFail];

  if (slot.onFinalStageSuccess) {
    rules.push(slot.onFinalStageSuccess);
  }

  if (slot.onUndefined) {
    rules.push(slot.onUndefined);
  }

  return rules;
}

/** Adds new rules from a slot to the rule map (deduplicated by type). */
function addRulesToMap(
  ruleMap: Map<string, ProgressionRuleEntry>,
  rules: readonly ProgressionRule[]
): void {
  for (const rule of rules) {
    if (ruleMap.has(rule.type)) continue;
    ruleMap.set(rule.type, {
      trigger: describeTrigger(rule),
      description: describeRule(rule),
    });
  }
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function buildProgramSummary(definition: ProgramDefinition): ProgramSummary {
  const exerciseMap = new Map<string, UniqueExercise>();
  const ruleMap = new Map<string, ProgressionRuleEntry>();
  const tierSet = new Set<string>();
  let maxStages = 0;

  const days: DaySummary[] = [];
  const progressionInfo: SlotProgressionInfo[] = [];

  for (const day of definition.days) {
    const slotSummaries: SlotSummary[] = [];

    for (const slot of day.slots) {
      const exerciseName = definition.exercises[slot.exerciseId]?.name ?? slot.exerciseId;
      const firstStage = slot.stages[0];
      const setsXReps = formatSetsXReps(firstStage.sets, firstStage.reps, firstStage.amrap);

      tierSet.add(slot.tier);

      // Track max stages
      if (slot.stages.length > maxStages) {
        maxStages = slot.stages.length;
      }

      // Deduplicate exercises by exerciseId
      if (!exerciseMap.has(slot.exerciseId)) {
        exerciseMap.set(slot.exerciseId, {
          name: exerciseName,
          tier: slot.tier,
          role: slot.role,
        });
      }

      // Collect progression rules (deduplicated by type)
      addRulesToMap(ruleMap, collectSlotRules(slot));

      // Build slot summary for day overview
      slotSummaries.push({
        exerciseName,
        tier: slot.tier,
        setsXReps,
        role: slot.role,
      });

      // Build progression info per slot
      const stages: StageInfo[] = slot.stages.map((stage) => ({
        label: formatSetsXReps(stage.sets, stage.reps, stage.amrap),
        amrap: stage.amrap === true,
      }));

      progressionInfo.push({
        exerciseName,
        tier: slot.tier,
        stages,
        onSuccessText: describeRule(slot.onSuccess),
        onFailText: describeRule(slot.onMidStageFail),
        role: slot.role,
        notes: slot.notes,
        isBodyweight: slot.isBodyweight,
      });
    }

    days.push({
      name: day.name,
      exercises: slotSummaries,
    });
  }

  // Config field summaries
  const configFields: ConfigFieldSummary[] = definition.configFields.map((field) => ({
    label: field.label,
    type: field.type,
    group: field.group,
    hint: field.type === 'weight' ? field.hint : undefined,
  }));

  const uniqueExercises = Array.from(exerciseMap.values());
  const tierList = Array.from(tierSet);

  return {
    totalWorkouts: definition.totalWorkouts,
    workoutsPerWeek: definition.workoutsPerWeek,
    cycleLength: definition.cycleLength,
    uniqueExerciseCount: uniqueExercises.length,
    uniqueExercises,
    days,
    progressionRules: Array.from(ruleMap.values()),
    progressionInfo,
    configFields,
    configFieldCount: definition.configFields.length,
    hasTiers: tierList.length > 1,
    tierList,
    hasStages: maxStages > 1,
    stageCount: maxStages,
  };
}
