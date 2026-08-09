import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  DayPhaseGroup,
  DaySummary,
  ExerciseBlockSummary,
  ProgramSummary,
  SlotLineSummary,
} from '@/lib/program-summary';
import { Kicker } from '@/components/kicker';
import { Tag } from '@/components/tag';
import { cn } from '@/lib/cn';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProgramOverviewProps {
  readonly summary: ProgramSummary;
  readonly programName: string;
}

// ---------------------------------------------------------------------------
// Tier styling
// ---------------------------------------------------------------------------

const TIER_TONE: Readonly<Record<string, 'gold' | 'default' | 'ok'>> = {
  T1: 'gold',
  main: 'gold',
  T2: 'default',
  supplemental: 'default',
  T3: 'ok',
  accessory: 'ok',
};

function tierTone(tier: string): 'gold' | 'default' | 'ok' {
  return TIER_TONE[tier] ?? 'default';
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TierBadge({ tier }: { readonly tier: string }): ReactNode {
  const { t } = useTranslation();
  const key = `program_overview.tier.${tier.toLowerCase()}`;
  const label = t(key, { defaultValue: tier });
  return <Tag tone={tierTone(tier)}>{label}</Tag>;
}

/** GZCL-style tiers benefit from role labels; named tiers already convey intent. */
function shouldShowRole(tier: string, role: string | undefined): role is string {
  if (role === undefined) return false;
  if (!['primary', 'secondary', 'accessory'].includes(role)) return false;
  return /^T\d+$/i.test(tier);
}

function RoleBadge({ role }: { readonly role: string }): ReactNode {
  const { t } = useTranslation();
  return (
    <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
      {t(`tracker.exercise_role.${role}`)}
    </span>
  );
}

function StatChip({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string | number;
}): ReactNode {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 border border-rule bg-body/40 px-3 py-2">
      <span className="font-mono text-[9px] font-bold uppercase tracking-[0.1em] text-muted">
        {label}
      </span>
      <span className="font-display-data text-lg leading-none tabular-nums text-title">
        {value}
      </span>
    </div>
  );
}

function SchemeChips({ schemes }: { readonly schemes: readonly string[] }): ReactNode {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {schemes.map((scheme, index) => (
        <span key={`${scheme}-${String(index)}`} className="inline-flex items-center gap-1">
          {index > 0 ? <span className="text-muted/50 font-mono text-[10px]">·</span> : null}
          <span className="font-mono text-[11px] font-semibold tabular-nums text-info">
            {scheme}
          </span>
        </span>
      ))}
    </div>
  );
}

function SlotLine({ line }: { readonly line: SlotLineSummary }): ReactNode {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <TierBadge tier={line.tier} />
      {shouldShowRole(line.tier, line.role) ? <RoleBadge role={line.role} /> : null}
      <SchemeChips schemes={line.schemes.length > 0 ? line.schemes : [line.setsXReps]} />
    </div>
  );
}

function ExerciseBlock({ block }: { readonly block: ExerciseBlockSummary }): ReactNode {
  return (
    <li className="border-t border-rule-light pt-2.5 first:border-t-0 first:pt-0">
      <p className="mb-1.5 text-sm font-semibold text-main">{block.exerciseName}</p>
      <ul className="space-y-1.5">
        {block.slots.map((line) => (
          <li key={`${block.exerciseName}-${line.tier}-${line.setsXReps}`}>
            <SlotLine line={line} />
          </li>
        ))}
      </ul>
    </li>
  );
}

function DayCard({ day, index }: { readonly day: DaySummary; readonly index: number }): ReactNode {
  const { t } = useTranslation();
  const label = day.title;
  return (
    <article className="flex h-full flex-col border border-rule bg-body/30 p-3.5 sm:p-4">
      <header className="mb-3 flex items-start gap-2">
        <span className="font-mono text-[10px] font-bold tabular-nums text-accent-deep">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <h5 className="text-xs font-bold leading-snug text-title">{label}</h5>
          <p className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-muted">
            {t('program_overview.exercise_count', { count: day.exercises.length })}
          </p>
        </div>
      </header>
      <ul className="space-y-2.5">
        {day.exercises.map((block) => (
          <ExerciseBlock key={`${day.name}-${block.exerciseName}`} block={block} />
        ))}
      </ul>
    </article>
  );
}

function PhaseTabs({
  phases,
  activeIndex,
  onChange,
}: {
  readonly phases: readonly DayPhaseGroup[];
  readonly activeIndex: number;
  readonly onChange: (index: number) => void;
}): ReactNode {
  const { t } = useTranslation();
  return (
    <div
      role="tablist"
      aria-label={t('program_overview.phase_tabs_aria')}
      className="mb-3 flex gap-1 overflow-x-auto pb-1"
    >
      {phases.map((group, index) => {
        const selected = index === activeIndex;
        const label = group.phase ?? t('program_overview.phase_fallback', { n: index + 1 });
        return (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => {
              onChange(index);
            }}
            className={cn(
              'shrink-0 cursor-pointer border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.08em] transition-colors',
              selected
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-rule text-muted hover:border-rule-light hover:text-main'
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function StatsStrip({ summary }: { readonly summary: ProgramSummary }): ReactNode {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatChip
        label={t('program_overview.stat_per_week')}
        value={t('program_overview.stat_per_week_value', { count: summary.workoutsPerWeek })}
      />
      <StatChip label={t('program_overview.stat_total')} value={summary.totalWorkouts} />
      <StatChip
        label={t('program_overview.stat_rotation')}
        value={
          summary.hasPhases
            ? t('program_overview.stat_rotation_phased', {
                days: summary.workoutsPerWeek,
                phases: summary.dayPhases.length,
              })
            : t('program_overview.stat_rotation_value', { count: summary.days.length })
        }
      />
      <StatChip label={t('program_overview.stat_lifts')} value={summary.uniqueExerciseCount} />
    </div>
  );
}

function DayRotationSection({ summary }: { readonly summary: ProgramSummary }): ReactNode {
  const { t } = useTranslation();
  const [phaseIndex, setPhaseIndex] = useState(0);

  const phases = summary.dayPhases;
  const safeIndex = Math.min(phaseIndex, Math.max(0, phases.length - 1));
  const activeGroup = phases[safeIndex];
  const visibleDays = summary.hasPhases ? (activeGroup?.days ?? summary.days) : summary.days;

  let baseIndexOffset = 0;
  if (summary.hasPhases) {
    for (let i = 0; i < safeIndex; i += 1) {
      baseIndexOffset += phases[i]?.days.length ?? 0;
    }
  }

  return (
    <div>
      <Kicker className="mb-3">{t('program_overview.day_structure')}</Kicker>
      {summary.hasPhases ? (
        <PhaseTabs phases={phases} activeIndex={safeIndex} onChange={setPhaseIndex} />
      ) : null}
      <div
        className={cn(
          'grid gap-3',
          visibleDays.length === 1
            ? 'grid-cols-1'
            : visibleDays.length === 2
              ? 'grid-cols-1 sm:grid-cols-2'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
        )}
      >
        {visibleDays.map((day, i) => (
          <DayCard key={day.name} day={day} index={baseIndexOffset + i} />
        ))}
      </div>
    </div>
  );
}

function ExerciseListSection({ summary }: { readonly summary: ProgramSummary }): ReactNode {
  const { t } = useTranslation();
  return (
    <div>
      <Kicker className="mb-3">
        {t('program_overview.exercises', { count: summary.uniqueExerciseCount })}
      </Kicker>
      <div className="flex flex-wrap gap-2">
        {summary.uniqueExercises.map((exercise) => (
          <div
            key={`${exercise.name}-${exercise.tier}`}
            className="flex items-center gap-1.5 border border-rule bg-body/30 px-2.5 py-1.5"
          >
            <TierBadge tier={exercise.tier} />
            <span className="text-xs text-main">{exercise.name}</span>
            {shouldShowRole(exercise.tier, exercise.role) ? (
              <RoleBadge role={exercise.role} />
            ) : null}
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
      <Kicker className="mb-3">{t('program_overview.progression_rules')}</Kicker>
      <ul className="space-y-2">
        {summary.progressionRules.map((rule, index) => (
          <li
            key={rule.description}
            className="flex gap-3 border border-rule bg-body/30 px-3 py-2.5"
          >
            <span className="font-mono text-[10px] font-bold tabular-nums text-accent-deep">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-main">{rule.description}</p>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted">
                {rule.trigger}
              </p>
            </div>
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
      <Kicker className="mb-3">{t('program_overview.stages')}</Kicker>
      <div className="border border-rule border-l-2 border-l-accent bg-body/30 px-4 py-3">
        <div className="mb-2 flex flex-wrap gap-1.5">
          {Array.from({ length: summary.stageCount }, (_, i) => (
            <Tag key={i} tone={i === 0 ? 'gold' : i === 1 ? 'default' : 'fail'}>
              {t('program_overview.stage_chip', { n: i + 1 })}
            </Tag>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-info">
          {t('program_overview.stages_description', { count: summary.stageCount })}
        </p>
      </div>
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
      className="mb-4 overflow-hidden border border-rule bg-card sm:mb-8"
      aria-label={t('program_overview.aria_label', { programName })}
    >
      <div className="border-b border-rule-light px-4 py-3.5 sm:px-5">
        <h3 className="font-display text-sm uppercase tracking-wide text-title">
          {t('program_overview.how_it_works')}
        </h3>
      </div>

      <div className="space-y-7 px-4 py-5 sm:px-5">
        <StatsStrip summary={summary} />
        <DayRotationSection summary={summary} />
        <ExerciseListSection summary={summary} />
        <ProgressionRulesSection summary={summary} />
        <StagesSummarySection summary={summary} />
      </div>
    </section>
  );
}
