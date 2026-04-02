import type { GraduationTarget, GraduationState } from '@gzclp/shared/graduation';
import { computeEpley1RM } from '@gzclp/shared/graduation';

interface GraduationPanelProps {
  readonly targets: readonly GraduationTarget[];
  readonly achieved: GraduationState;
  readonly config: Record<string, number | string>;
  readonly onStartJaw: (estimatedTMs: Record<string, number>) => void;
  readonly onDismiss: () => void;
}

const EXERCISE_LABELS: Readonly<Record<string, string>> = {
  squat: 'Sentadilla',
  bench: 'Press Banca',
  deadlift: 'Peso Muerto',
};

const REP_CRITERIA: Readonly<Record<string, string>> = {
  squat: '3 reps (tempo 5-3-5)',
  bench: '1 rep (tecnica perfecta)',
  deadlift: '10 reps (controlado)',
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
        {achieved.allPassed ? 'Graduacion Completada' : 'Objetivos de Graduacion'}
      </h3>
      <p className="text-[13px] text-muted mb-4">
        {achieved.allPassed
          ? 'Has alcanzado todos los objetivos. Estas listo para el Protocollo JAW.'
          : 'Completa estos objetivos para graduarte al siguiente programa.'}
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
                  {EXERCISE_LABELS[target.exercise] ?? target.exercise}
                </p>
                <p className="text-[12px] text-muted">
                  {REP_CRITERIA[target.exercise] ?? target.description} @ {target.targetWeight} kg
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
          <p className="text-sm font-bold text-title mb-3">Tus 1RM estimados (Epley):</p>
          <div className="flex flex-wrap gap-3 mb-4">
            {Object.entries(estimatedOneRMs).map(([exercise, oneRM]) => (
              <div
                key={exercise}
                className="px-3 py-2 bg-header/10 border border-rule rounded-sm text-center"
              >
                <p className="text-[11px] font-bold uppercase text-muted">
                  {EXERCISE_LABELS[exercise] ?? exercise}
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
              Empezar Protocollo JAW
            </button>
            <button
              onClick={onDismiss}
              className="py-3.5 px-4 border-2 border-rule bg-card text-muted text-sm font-bold cursor-pointer hover:bg-hover-row hover:text-main transition-colors"
            >
              Seguir entrenando
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
