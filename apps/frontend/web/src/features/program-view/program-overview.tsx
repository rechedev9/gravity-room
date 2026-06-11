import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProgramSummary } from '@/lib/program-summary';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProgramOverviewProps {
  readonly summary: ProgramSummary;
  readonly programName: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TIER_COLORS: Readonly<Record<string, string>> = {
  T1: 'border-amber-500/60 text-amber-400',
  T2: 'border-sky-500/60 text-sky-400',
  T3: 'border-emerald-500/60 text-emerald-400',
};

const DEFAULT_TIER_COLOR = 'border-rule text-muted';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TierBadge({ tier }: { readonly tier: string }): ReactNode {
  const colors = TIER_COLORS[tier] ?? DEFAULT_TIER_COLOR;
  return (
    <span
      className={`inline-block text-2xs font-bold uppercase tracking-wider px-1.5 py-0.5 border ${colors}`}
    >
      {tier}
    </span>
  );
}

function RoleBadge({ role }: { readonly role: string }): ReactNode {
  const { t } = useTranslation();
  const label = ['primary', 'secondary', 'accessory'].includes(role)
    ? t(`tracker.exercise_role.${role}`)
    : role;
  return <span className="text-2xs text-muted uppercase tracking-wider">{label}</span>;
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function DayRotationSection({ summary }: { readonly summary: ProgramSummary }): ReactNode {
  const { t } = useTranslation();
  return (
    <div>
      <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
        {t('program_overview.day_structure')}
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {summary.days.map((day) => (
          <div key={day.name} className="border border-rule p-3">
            <h5 className="text-xs font-bold text-title mb-2">{day.name}</h5>
            <ul className="space-y-1.5">
              {day.exercises.map((slot) => (
                <li
                  key={`${day.name}-${slot.exerciseName}-${slot.tier}`}
                  className="flex items-center gap-2"
                >
                  <TierBadge tier={slot.tier} />
                  <span className="text-xs text-main">{slot.exerciseName}</span>
                  <span className="ml-auto font-mono text-2xs text-info">{slot.setsXReps}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExerciseListSection({ summary }: { readonly summary: ProgramSummary }): ReactNode {
  const { t } = useTranslation();
  return (
    <div>
      <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
        {t('program_overview.exercises', { count: summary.uniqueExerciseCount })}
      </h4>
      <div className="flex flex-wrap gap-2">
        {summary.uniqueExercises.map((exercise) => (
          <div
            key={`${exercise.name}-${exercise.tier}`}
            className="flex items-center gap-1.5 border border-rule px-2.5 py-1.5"
          >
            <TierBadge tier={exercise.tier} />
            <span className="text-xs text-main">{exercise.name}</span>
            {exercise.role !== undefined && <RoleBadge role={exercise.role} />}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProgressionRulesSection({ summary }: { readonly summary: ProgramSummary }): ReactNode {
  const { t } = useTranslation();
  if (summary.progressionRules.length === 0) return null;

  return (
    <div>
      <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
        {t('program_overview.progression_rules')}
      </h4>
      <ul className="space-y-2">
        {summary.progressionRules.map((rule) => (
          <li key={rule.description} className="flex flex-col gap-0.5 border-l-2 border-rule pl-3">
            <span className="text-xs text-main">{rule.description}</span>
            <span className="text-2xs text-muted">{rule.trigger}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StagesSummarySection({ summary }: { readonly summary: ProgramSummary }): ReactNode {
  const { t } = useTranslation();
  if (!summary.hasStages) return null;

  return (
    <div>
      <h4 className="text-xs font-bold text-muted uppercase tracking-wider mb-3">
        {t('program_overview.stages')}
      </h4>
      <p className="text-xs text-info leading-relaxed">
        {t('program_overview.stages_description', { count: summary.stageCount })}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ProgramOverview({ summary, programName }: ProgramOverviewProps): ReactNode {
  const { t } = useTranslation();
  return (
    <section
      className="bg-card border border-rule mb-4 sm:mb-8 overflow-hidden"
      aria-label={t('program_overview.aria_label', { programName })}
    >
      <div className="px-5 py-4 border-b border-rule-light">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted">
          {t('program_overview.how_it_works')}
        </h3>
      </div>

      <div className="px-5 py-5 space-y-6">
        <DayRotationSection summary={summary} />
        <ExerciseListSection summary={summary} />
        <ProgressionRulesSection summary={summary} />
        <StagesSummarySection summary={summary} />
      </div>
    </section>
  );
}
