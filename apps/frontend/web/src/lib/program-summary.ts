import type { TFunction } from 'i18next';
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

/** Maps a progression rule to a localized description string. */
function describeRule(rule: ProgressionRule, t?: TFunction): string {
  switch (rule.type) {
    case 'add_weight':
      if (t) return t('program_summary.rules.add_weight');
      return 'Sube peso en el siguiente entrenamiento';
    case 'deload_percent':
      if (t) return t('program_summary.rules.deload_percent', { percent: rule.percent });
      return `Descarga al ${rule.percent}% del peso actual`;
    case 'advance_stage':
      if (t) return t('program_summary.rules.advance_stage');
      return 'Pasa a la siguiente etapa (menos reps, más series)';
    case 'add_weight_reset_stage':
      if (t) return t('program_summary.rules.add_weight_reset_stage', { amount: rule.amount });
      return `Sube ${rule.amount} kg y vuelve a la primera etapa`;
    case 'no_change':
      if (t) return t('program_summary.rules.no_change');
      return 'Mantiene el peso actual';
    case 'advance_stage_add_weight':
      if (t) return t('program_summary.rules.advance_stage_add_weight');
      return 'Sube peso y pasa de etapa';
    case 'update_tm':
      if (t) return t('program_summary.rules.update_tm', { amount: rule.amount });
      return `Actualiza el training max en ${rule.amount} kg`;
    case 'double_progression':
      if (t) {
        return t('program_summary.rules.double_progression', {
          bottom: rule.repRangeBottom,
          top: rule.repRangeTop,
        });
      }
      return `Sube reps (${rule.repRangeBottom}-${rule.repRangeTop}); al tope, sube peso`;
  }

  return '';
}

/** Maps a progression rule to its trigger context string. */
function describeTrigger(rule: ProgressionRule, t?: TFunction): string {
  switch (rule.type) {
    case 'add_weight':
    case 'double_progression':
    case 'advance_stage_add_weight':
      if (t) return t('program_summary.triggers.complete_all_sets');
      return 'Completar todas las series';
    case 'advance_stage':
      if (t) return t('program_summary.triggers.mid_program_fail');
      return 'Fallar a mitad del programa';
    case 'deload_percent':
      if (t) return t('program_summary.triggers.final_stage_fail');
      return 'Fallar en la última etapa';
    case 'add_weight_reset_stage':
      if (t) return t('program_summary.triggers.final_stage_success');
      return 'Completar la última etapa';
    case 'no_change':
      if (t) return t('program_summary.triggers.undefined_result');
      return 'Resultado indefinido';
    case 'update_tm':
      if (t) return t('program_summary.triggers.amrap_threshold', { reps: rule.minAmrapReps });
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
  rules: readonly ProgressionRule[],
  t?: TFunction
): void {
  for (const rule of rules) {
    if (ruleMap.has(rule.type)) continue;
    ruleMap.set(rule.type, {
      trigger: describeTrigger(rule, t),
      description: describeRule(rule, t),
    });
  }
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export function buildProgramSummary(definition: ProgramDefinition, t?: TFunction): ProgramSummary {
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
      addRulesToMap(ruleMap, collectSlotRules(slot), t);

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
        onSuccessText: describeRule(slot.onSuccess, t),
        onFailText: describeRule(slot.onMidStageFail, t),
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
