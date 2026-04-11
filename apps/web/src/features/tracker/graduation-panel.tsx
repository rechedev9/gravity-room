import type { GraduationTarget, GraduationState } from '@gzclp/shared/graduation';
import { useTranslation } from 'react-i18next';
import { computeEpley1RM } from '@gzclp/shared/graduation';

interface GraduationPanelProps {
  readonly targets: readonly GraduationTarget[];
  readonly achieved: GraduationState;
  readonly config: Record<string, number | string>;
  readonly onStartJaw: (estimatedTMs: Record<string, number>) => void;
  readonly onDismiss: () => void;
}

const EXERCISE_LABELS: Readonly<Record<string, string>> = {
  squat: 'tracker.graduation.squat',
  bench: 'tracker.graduation.bench',
  deadlift: 'tracker.graduation.deadlift',
};

const REP_CRITERIA: Readonly<Record<string, string>> = {
  squat: 'tracker.graduation.squat_criteria',
  bench: 'tracker.graduation.bench_criteria',
  deadlift: 'tracker.graduation.deadlift_criteria',
};

function roundToNearest(value: number, rounding: number): number {
  if (rounding <= 0) return value;
  return Math.round(value / rounding) * rounding;
}

export function GraduationPanel({
  targets,
  achieved,
  config,
  onStartJaw,
  onDismiss,
}: GraduationPanelProps): React.ReactNode {
  const { t } = useTranslation();
  const rounding = typeof config.rounding === 'string' ? parseFloat(config.rounding) : 2.5;

  // Compute Epley 1RM estimates for each target
  const estimatedOneRMs: Record<string, number> = {};
  for (const target of targets) {
    if (achieved[target.exercise]) {
      const raw1RM = computeEpley1RM(target.targetWeight, target.requiredReps);
      estimatedOneRMs[target.exercise] = roundToNearest(raw1RM, rounding);
    }
  }

  const handleStartJaw = (): void => {
    // Pre-populate JAW TMs at 90% of estimated 1RM
    const tms: Record<string, number> = {};
    for (const [exercise, oneRM] of Object.entries(estimatedOneRMs)) {
      tms[`${exercise}_tm`] = roundToNearest(oneRM * 0.9, rounding);
    }
    onStartJaw(tms);
  };

  return (
    <div className="bg-card border border-rule p-4 sm:p-6 card">
      <h3 className="font-display text-xl text-title mb-1">
        {achieved.allPassed
          ? t('tracker.graduation.completed')
          : t('tracker.graduation.objectives')}
      </h3>
      <p className="text-[13px] text-muted mb-4">
        {achieved.allPassed
          ? t('tracker.graduation.all_passed_message')
          : t('tracker.graduation.incomplete_message')}
      </p>

      {/* Criteria checklist */}
      <div className="flex flex-col gap-3 mb-5">
        {targets.map((target) => {
          const done = achieved[target.exercise];
          return (
            <div
              key={target.exercise}
              className={`flex items-center gap-3 p-3 border-2 rounded-sm transition-colors ${
                done ? 'border-ok-ring bg-ok-bg/30' : 'border-rule bg-transparent'
              }`}
            >
              <span className={`text-lg font-bold ${done ? 'text-ok' : 'text-muted'}`}>
                {done ? '\u2713' : '\u25CB'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-title">
                  {t(EXERCISE_LABELS[target.exercise] ?? target.exercise)}
                </p>
                <p className="text-[12px] text-muted">
                  {t(REP_CRITERIA[target.exercise] ?? target.description)} @ {target.targetWeight}{' '}
                  kg
                </p>
              </div>
              {done && estimatedOneRMs[target.exercise] !== undefined && (
                <span className="text-[11px] font-bold text-ok whitespace-nowrap">
                  1RM: ~{estimatedOneRMs[target.exercise]} kg
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Celebration + CTAs when all passed */}
      {achieved.allPassed && (
        <div className="border-t border-rule pt-4">
          <img src="/graduation-badge.webp" alt="" className="w-20 h-20 mx-auto mb-4 opacity-90" />
          <p className="text-sm font-bold text-title mb-3">
            {t('tracker.graduation.estimated_1rm')}
          </p>
          <div className="flex flex-wrap gap-3 mb-4">
            {Object.entries(estimatedOneRMs).map(([exercise, oneRM]) => (
              <div
                key={exercise}
                className="px-3 py-2 bg-header/10 border border-rule rounded-sm text-center"
              >
                <p className="text-[11px] font-bold uppercase text-muted">
                  {t(EXERCISE_LABELS[exercise] ?? exercise)}
                </p>
                <p className="font-display text-lg text-accent">{oneRM} kg</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleStartJaw}
              className="flex-1 py-3.5 border-none bg-header text-title text-base font-bold cursor-pointer hover:opacity-85 transition-opacity"
            >
              {t('tracker.graduation.start_jaw')}
            </button>
            <button
              onClick={onDismiss}
              className="py-3.5 px-4 border-2 border-rule bg-card text-muted text-sm font-bold cursor-pointer hover:bg-hover-row hover:text-main transition-colors"
            >
              {t('tracker.graduation.keep_training')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
