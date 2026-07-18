import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GenericSlotRow, GenericWorkoutRow } from '@gzclp/domain/types';
import type { ProgramSummary } from '@/lib/program-summary';

interface ProgramPreviewHeroProps {
  readonly name: string;
  readonly description: string;
  readonly author?: string;
  readonly totalWorkouts: number;
  readonly workoutsPerWeek: number;
  readonly cycleLength: number;
  readonly cycleLabels: readonly string[];
  readonly primaryAction: ReactNode;
  readonly actionNote?: string;
  readonly onShowExample: () => void;
}

function DossierStat({
  value,
  label,
}: {
  readonly value: number;
  readonly label: string;
}): ReactNode {
  return (
    <div className="flex items-baseline gap-3 border-b border-rule/70 py-3 last:border-b-0">
      <span className="font-display-data text-4xl leading-none text-title tabular-nums">
        {value}
      </span>
      <span className="font-mono text-2xs uppercase tracking-[0.2em] text-muted">{label}</span>
    </div>
  );
}

export function ProgramPreviewHero({
  name,
  description,
  author,
  totalWorkouts,
  workoutsPerWeek,
  cycleLength,
  cycleLabels,
  primaryAction,
  actionNote,
  onShowExample,
}: ProgramPreviewHeroProps): ReactNode {
  const { t } = useTranslation();
  const weekCount = Math.ceil(totalWorkouts / workoutsPerWeek);

  return (
    <section className="relative border-b border-rule py-10 sm:py-14 lg:py-16">
      <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,rgba(242,185,46,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(242,185,46,0.035)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(460px,0.9fr)] lg:items-stretch">
        <div className="flex flex-col justify-center">
          <div className="mb-5 flex items-center gap-3 font-mono text-2xs uppercase tracking-[0.32em] text-accent">
            <span className="h-px w-7 bg-accent" />
            {t('catalog.program_preview.strength_program')}
          </div>
          <h1 className="max-w-4xl font-display text-[clamp(3.7rem,7.5vw,7rem)] uppercase leading-[0.86] tracking-[0.015em] text-title">
            {name}
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-info sm:text-lg sm:leading-8">
            {description}
          </p>
          <div className="mt-5 flex items-center gap-3 font-mono text-2xs uppercase tracking-[0.22em] text-muted">
            <span className="grid size-8 place-items-center border border-accent/60 text-accent">
              GR
            </span>
            {author !== undefined
              ? t('catalog.program_preview.by_author', { author })
              : t('catalog.program_preview.by_gravity_room')}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            {primaryAction}
            <button
              type="button"
              onClick={onShowExample}
              className="min-h-12 border border-rule bg-card/60 px-6 font-mono text-xs font-bold uppercase tracking-[0.18em] text-main transition-colors hover:border-accent/60 hover:text-accent"
            >
              {t('catalog.program_preview.view_example')}
              <span aria-hidden="true" className="ml-3 text-accent">
                ↓
              </span>
            </button>
          </div>
          {actionNote !== undefined && (
            <p className="mt-3 max-w-xl text-xs leading-5 text-amber-400">{actionNote}</p>
          )}
        </div>

        <aside
          className="border border-rule bg-card/70"
          aria-label={t('catalog.program_preview.dossier')}
        >
          <div className="border-b border-rule px-6 py-4 font-mono text-xs font-bold uppercase tracking-[0.25em] text-accent">
            {t('catalog.program_preview.dossier')}
          </div>
          <div className="grid h-[calc(100%-49px)] sm:grid-cols-[0.82fr_1.18fr]">
            <div className="border-b border-rule px-6 py-3 sm:border-b-0 sm:border-r">
              <DossierStat value={weekCount} label={t('catalog.program_preview.weeks')} />
              <DossierStat
                value={workoutsPerWeek}
                label={t('catalog.program_preview.days_per_week')}
              />
              <DossierStat value={totalWorkouts} label={t('catalog.program_preview.sessions')} />
              <DossierStat value={cycleLength} label={t('catalog.program_preview.rotation_days')} />
            </div>
            <div className="flex min-h-64 flex-col justify-center px-6 py-7">
              <p className="font-mono text-2xs uppercase tracking-[0.24em] text-muted">
                {t('catalog.program_preview.cycle_length', { count: cycleLabels.length })}
              </p>
              <div className="mt-8 flex items-center justify-between gap-2">
                {cycleLabels.slice(0, 4).map((label, index) => (
                  <div key={`${label}-${index}`} className="contents">
                    <span
                      className={`grid size-[4.4rem] shrink-0 place-items-center rounded-full border font-display text-xl uppercase tracking-wide sm:size-20 ${
                        index === 0 ? 'border-accent text-accent' : 'border-rule-light text-muted'
                      }`}
                    >
                      {label}
                    </span>
                    {index < Math.min(cycleLabels.length, 4) - 1 && (
                      <span aria-hidden="true" className="text-xl text-muted">
                        →
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-8 text-xs leading-5 text-muted">
                {t('catalog.program_preview.cycle_repeats')}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

export interface CycleGroup {
  readonly label: string;
  readonly startIndex: number;
  readonly workouts: readonly GenericWorkoutRow[];
}

function getCycleLabel(dayName: string, fallback: string): string {
  const separatorIndex = dayName.indexOf('—');
  return separatorIndex === -1 ? fallback : dayName.slice(0, separatorIndex).trim();
}

function getWorkoutLabel(dayName: string): string {
  const separatorIndex = dayName.indexOf('—');
  return separatorIndex === -1 ? dayName : dayName.slice(separatorIndex + 1).trim();
}

export function buildCycleGroups(
  rows: readonly GenericWorkoutRow[],
  cycleLength: number,
  workoutsPerWeek: number,
  weekLabel: (week: number) => string
): readonly CycleGroup[] {
  const cycleRows = rows.slice(0, cycleLength);
  const groups: CycleGroup[] = [];

  for (let startIndex = 0; startIndex < cycleRows.length; startIndex += workoutsPerWeek) {
    const workouts = cycleRows.slice(startIndex, startIndex + workoutsPerWeek);
    const fallback = weekLabel(groups.length + 1);
    groups.push({
      label: getCycleLabel(workouts[0]?.dayName ?? fallback, fallback),
      startIndex,
      workouts,
    });
  }

  return groups;
}

interface ProgramCycleProps {
  readonly groups: readonly CycleGroup[];
  readonly selectedDayIndex: number;
  readonly workoutsPerWeek: number;
  readonly onSelectDay: (index: number) => void;
}

export function ProgramCycle({
  groups,
  selectedDayIndex,
  workoutsPerWeek,
  onSelectDay,
}: ProgramCycleProps): ReactNode {
  const { t } = useTranslation();
  const selectedGroup = Math.floor(selectedDayIndex / workoutsPerWeek) % Math.max(groups.length, 1);

  return (
    <section
      className="border-b border-rule py-10 sm:py-14"
      aria-labelledby="program-cycle-heading"
    >
      <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.24em] text-accent">
            {t('catalog.program_preview.training_system')}
          </p>
          <h2
            id="program-cycle-heading"
            className="mt-2 font-display text-4xl uppercase text-title"
          >
            {t('catalog.program_preview.how_you_train')}
          </h2>
        </div>
        <p className="max-w-lg text-sm leading-6 text-muted">
          {t('catalog.program_preview.cycle_repeats')}
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {groups.map((group, groupIndex) => {
          const selected = groupIndex === selectedGroup;
          return (
            <button
              key={`${group.label}-${group.startIndex}`}
              type="button"
              onClick={() => onSelectDay(group.startIndex)}
              className={`group min-h-64 border p-0 text-left transition-colors ${
                selected
                  ? 'border-accent bg-accent/[0.045]'
                  : 'border-rule bg-card/45 hover:border-rule-light hover:bg-card'
              }`}
              aria-pressed={selected}
            >
              <div className="flex items-center justify-between border-b border-inherit px-5 py-4">
                <span className="font-mono text-2xs uppercase tracking-[0.2em] text-muted">
                  {t('catalog.program_preview.week_number', { number: groupIndex + 1 })}
                </span>
                <span
                  className={`font-display text-2xl uppercase ${selected ? 'text-accent' : 'text-title'}`}
                >
                  {group.label}
                </span>
              </div>
              <div className="divide-y divide-rule/60 px-5">
                {group.workouts.map((workout, workoutIndex) => (
                  <div key={workout.index} className="flex gap-4 py-4">
                    <span className="font-mono text-2xs uppercase tracking-wider text-accent">
                      {t('catalog.program_preview.day_number', { number: workoutIndex + 1 })}
                    </span>
                    <span className="font-display text-lg uppercase leading-5 text-main">
                      {getWorkoutLabel(workout.dayName)}
                    </span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

interface ExercisePrescription {
  readonly exerciseName: string;
  readonly schemes: readonly string[];
}

function formatSlotScheme(slot: GenericSlotRow): string {
  if (slot.prescriptions !== undefined && slot.prescriptions.length > 0) {
    const workingSet = slot.prescriptions[slot.prescriptions.length - 1];
    return `${workingSet.sets}×${slot.complexReps ?? workingSet.reps} · ${workingSet.percent}%`;
  }

  return `${slot.sets}×${slot.complexReps ?? slot.reps}${slot.isAmrap ? '+' : ''}`;
}

export function groupWorkoutExercises(
  slots: readonly GenericSlotRow[]
): readonly ExercisePrescription[] {
  const exercises = new Map<string, string[]>();
  for (const slot of slots) {
    const schemes = exercises.get(slot.exerciseName) ?? [];
    schemes.push(formatSlotScheme(slot));
    exercises.set(slot.exerciseName, schemes);
  }
  return Array.from(exercises, ([exerciseName, schemes]) => ({ exerciseName, schemes }));
}

interface SessionExampleProps {
  readonly workout: GenericWorkoutRow;
  readonly selectedDayIndex: number;
  readonly totalWorkouts: number;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}

export function SessionExample({
  workout,
  selectedDayIndex,
  totalWorkouts,
  onPrev,
  onNext,
}: SessionExampleProps): ReactNode {
  const { t } = useTranslation();
  const exercises = groupWorkoutExercises(workout.slots);

  return (
    <section id="session-example" className="scroll-mt-24 border-b border-rule py-10 sm:py-14">
      <div className="mb-7 flex items-end justify-between gap-5">
        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.24em] text-accent">
            {t('catalog.program_preview.inside_workout')}
          </p>
          <h2 className="mt-2 font-display text-4xl uppercase text-title">
            {t('catalog.program_preview.example_session')}
          </h2>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={selectedDayIndex <= 0}
            aria-label={t('tracker.day_navigator.prev_aria')}
            className="grid size-11 place-items-center border border-rule bg-card text-main transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-30"
          >
            ←
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={selectedDayIndex >= totalWorkouts - 1}
            aria-label={t('tracker.day_navigator.next_aria')}
            className="grid size-11 place-items-center border border-rule bg-card text-main transition-colors hover:border-accent disabled:cursor-not-allowed disabled:opacity-30"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid border border-accent/70 bg-card/70 lg:grid-cols-[150px_minmax(0,1fr)]">
        <div className="flex items-center justify-between border-b border-accent/40 px-5 py-5 lg:block lg:border-b-0 lg:border-r">
          <span className="font-mono text-2xs uppercase tracking-[0.2em] text-accent">
            {t('tracker.day_navigator.day_label')}
          </span>
          <span className="font-display-data text-6xl leading-none text-accent tabular-nums">
            {selectedDayIndex + 1}
          </span>
          <span className="font-mono text-2xs text-muted">/ {totalWorkouts}</span>
        </div>
        <div>
          <div className="border-b border-rule px-6 py-5 sm:px-8">
            <p className="font-display text-2xl uppercase tracking-wide text-title sm:text-3xl">
              {getWorkoutLabel(workout.dayName)}
            </p>
            <p className="mt-1 font-mono text-2xs uppercase tracking-[0.16em] text-muted">
              {getCycleLabel(workout.dayName, t('catalog.program_preview.program_day'))}
            </p>
          </div>
          <div className="grid divide-y divide-rule sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            {exercises.map((exercise) => (
              <div key={exercise.exerciseName} className="px-6 py-6 sm:px-8">
                <p className="font-mono text-2xs uppercase tracking-[0.22em] text-accent">
                  {exercise.exerciseName}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {exercise.schemes.map((scheme, index) => (
                    <span
                      key={`${scheme}-${index}`}
                      className="border border-rule px-3 py-2 font-mono text-xs text-main"
                    >
                      {scheme}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProgramEssentials({ summary }: { readonly summary: ProgramSummary }): ReactNode {
  const { t } = useTranslation();
  return (
    <section className="grid gap-4 border-b border-rule py-10 sm:py-14 lg:grid-cols-2">
      <div className="border border-rule bg-card/45 p-6 sm:p-8">
        <p className="font-mono text-2xs uppercase tracking-[0.22em] text-accent">
          {t('program_overview.progression_rules')}
        </p>
        <ul className="mt-6 space-y-5">
          {summary.progressionRules.map((rule) => (
            <li
              key={`${rule.trigger}-${rule.description}`}
              className="border-l border-accent/60 pl-4"
            >
              <p className="text-sm font-bold text-main">{rule.description}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{rule.trigger}</p>
            </li>
          ))}
        </ul>
      </div>
      <div className="border border-rule bg-card/45 p-6 sm:p-8">
        <p className="font-mono text-2xs uppercase tracking-[0.22em] text-accent">
          {t('program_overview.exercises', { count: summary.uniqueExerciseCount })}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {summary.uniqueExercises.map((exercise) => (
            <span
              key={`${exercise.name}-${exercise.tier}`}
              className="border border-rule px-4 py-3 text-sm text-main"
            >
              <span className="mr-2 font-mono text-2xs uppercase tracking-wider text-muted">
                {exercise.tier}
              </span>
              {exercise.name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
