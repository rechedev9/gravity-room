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

/** One prescription line within an exercise block (may merge several slots). */
export interface SlotLineSummary {
  readonly tier: string;
  readonly setsXReps: string;
  readonly schemes: readonly string[];
  readonly role?: string;
}

/** Grouped exercise within a day (consecutive same-exercise slots collapse). */
export interface ExerciseBlockSummary {
  readonly exerciseName: string;
  readonly slots: readonly SlotLineSummary[];
}

/** One day's breakdown for the overview. */
export interface DaySummary {
  readonly name: string;
  /** Day title without phase prefix when name uses "Phase — Title". */
  readonly title: string;
  /** Phase/week label when name uses "Phase — Title"; otherwise null. */
  readonly phase: string | null;
  readonly exercises: readonly ExerciseBlockSummary[];
}

/** Phase bucket used by the overview week tabs. */
export interface DayPhaseGroup {
  readonly phase: string | null;
  readonly days: readonly DaySummary[];
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
  readonly dayPhases: readonly DayPhaseGroup[];
  readonly hasPhases: boolean;
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
type SlotShape = ProgramDefinition['days'][number]['slots'][number];
type StageShape = SlotShape['stages'][number];

const DAY_NAME_SEP = ' — ';

export function splitDayName(name: string): {
  readonly phase: string | null;
  readonly title: string;
} {
  const idx = name.indexOf(DAY_NAME_SEP);
  if (idx <= 0) return { phase: null, title: name };
  return {
    phase: name.slice(0, idx).trim(),
    title: name.slice(idx + DAY_NAME_SEP.length).trim() || name,
  };
}

export function groupDaysByPhase(days: readonly DaySummary[]): readonly DayPhaseGroup[] {
  if (days.length === 0) return [];

  const groups: DayPhaseGroup[] = [];
  for (const day of days) {
    const last = groups[groups.length - 1];
    if (last !== undefined && last.phase === day.phase) {
      groups[groups.length - 1] = {
        phase: last.phase,
        days: [...last.days, day],
      };
      continue;
    }
    groups.push({ phase: day.phase, days: [day] });
  }
  return groups;
}

function formatPercent(tmPercent: number): string {
  const pct = tmPercent * 100;
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded}%`;
}

/** Formats a single stage, optionally with TM % loading. */
export function formatSetsXReps(
  sets: number,
  reps: number,
  amrap?: boolean,
  tmPercent?: number
): string {
  const amrapMark = amrap === true ? '+' : '';
  if (tmPercent !== undefined) {
    const pct = formatPercent(tmPercent);
    if (sets === 1) return `${pct}×${reps}${amrapMark}`;
    return `${pct} ${sets}×${reps}${amrapMark}`;
  }
  return `${sets}×${reps}${amrapMark}`;
}

function schemeForSlot(slot: SlotShape): string {
  const firstStage: StageShape = slot.stages[0];
  return formatSetsXReps(firstStage.sets, firstStage.reps, firstStage.amrap, slot.tmPercent);
}

function joinSchemes(schemes: readonly string[]): string {
  return schemes.join(' · ');
}

const ROLE_RANK: Readonly<Record<string, number>> = {
  primary: 3,
  secondary: 2,
  accessory: 1,
};

function preferredRole(current: string | undefined, next: string | undefined): string | undefined {
  if (current === undefined) return next;
  if (next === undefined) return current;
  return (ROLE_RANK[next] ?? 0) > (ROLE_RANK[current] ?? 0) ? next : current;
}

/**
 * Collapses consecutive slots that share exerciseId + tier into one line.
 * Different tiers for the same exercise become separate lines under one block.
 */
export function groupDaySlots(
  slots: readonly SlotShape[],
  exercises: ProgramDefinition['exercises']
): readonly ExerciseBlockSummary[] {
  const blocks: {
    exerciseId: string;
    exerciseName: string;
    lines: { tier: string; role?: string; schemes: string[] }[];
  }[] = [];

  for (const slot of slots) {
    const exerciseName = exercises[slot.exerciseId]?.name ?? slot.exerciseId;
    const scheme = schemeForSlot(slot);
    const lastBlock = blocks[blocks.length - 1];

    if (lastBlock !== undefined && lastBlock.exerciseId === slot.exerciseId) {
      const lastLine = lastBlock.lines[lastBlock.lines.length - 1];
      if (lastLine !== undefined && lastLine.tier === slot.tier) {
        lastLine.schemes.push(scheme);
        lastLine.role = preferredRole(lastLine.role, slot.role);
        continue;
      }
      lastBlock.lines.push({
        tier: slot.tier,
        role: slot.role,
        schemes: [scheme],
      });
      continue;
    }

    blocks.push({
      exerciseId: slot.exerciseId,
      exerciseName,
      lines: [
        {
          tier: slot.tier,
          role: slot.role,
          schemes: [scheme],
        },
      ],
    });
  }

  return blocks.map((block) => ({
    exerciseName: block.exerciseName,
    slots: block.lines.map((line) => ({
      tier: line.tier,
      role: line.role,
      schemes: line.schemes,
      setsXReps: joinSchemes(line.schemes),
    })),
  }));
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
    for (const slot of day.slots) {
      const exerciseName = definition.exercises[slot.exerciseId]?.name ?? slot.exerciseId;
      tierSet.add(slot.tier);

      if (slot.stages.length > maxStages) {
        maxStages = slot.stages.length;
      }

      if (!exerciseMap.has(slot.exerciseId)) {
        exerciseMap.set(slot.exerciseId, {
          name: exerciseName,
          tier: slot.tier,
          role: slot.role,
        });
      }

      addRulesToMap(ruleMap, collectSlotRules(slot), t);

      const stages: StageInfo[] = slot.stages.map((stage) => ({
        label: formatSetsXReps(stage.sets, stage.reps, stage.amrap, slot.tmPercent),
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

    const { phase, title } = splitDayName(day.name);
    days.push({
      name: day.name,
      title,
      phase,
      exercises: groupDaySlots(day.slots, definition.exercises),
    });
  }

  const configFields: ConfigFieldSummary[] = definition.configFields.map((field) => ({
    label: field.label,
    type: field.type,
    group: field.group,
    hint: field.type === 'weight' ? field.hint : undefined,
  }));

  const uniqueExercises = Array.from(exerciseMap.values());
  const tierList = Array.from(tierSet);
  const dayPhases = groupDaysByPhase(days);
  const distinctPhases = new Set(days.map((d) => d.phase).filter((p) => p !== null));
  const hasPhases = distinctPhases.size > 1;

  return {
    totalWorkouts: definition.totalWorkouts,
    workoutsPerWeek: definition.workoutsPerWeek,
    cycleLength: definition.cycleLength,
    uniqueExerciseCount: uniqueExercises.length,
    uniqueExercises,
    days,
    dayPhases,
    hasPhases,
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
