import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { ArticleLang } from '@gzclp/domain/schemas/exercise-article';
import type {
  VersusAxis,
  VersusPoint,
  VersusResult,
  VersusScores,
} from '@gzclp/domain/schemas/exercise-versus';
import { GOAL_WEIGHTS, LOWER_IS_BETTER, weightedAxesForGoal } from '@gzclp/domain/exercise-versus';
import { getVersusProfile } from '@gzclp/domain/exercise-versus-profiles';
import { cn } from '@/lib/cn';

interface ExerciseVersusResultViewProps {
  readonly result: VersusResult;
  readonly lang: ArticleLang;
}

function scoreShare(a: number, b: number): { readonly aPct: number; readonly bPct: number } {
  const total = Math.abs(a) + Math.abs(b);
  if (total <= 0) return { aPct: 50, bPct: 50 };
  const aPct = Math.round((Math.abs(a) / total) * 1000) / 10;
  return { aPct, bPct: Math.round((100 - aPct) * 10) / 10 };
}

function axisAdvantageSide(
  axis: VersusAxis,
  scoreA: number,
  scoreB: number,
  weight: number | undefined
): 'a' | 'b' | 'tie' {
  if (Math.abs(scoreA - scoreB) < 0.05) return 'tie';
  if (weight !== undefined && weight !== 0) {
    if (weight > 0) return scoreA > scoreB ? 'a' : 'b';
    return scoreA < scoreB ? 'a' : 'b';
  }
  if (LOWER_IS_BETTER.has(axis)) return scoreA < scoreB ? 'a' : 'b';
  return scoreA > scoreB ? 'a' : 'b';
}

function proAxisLabel(
  t: (key: string) => string,
  axis: VersusAxis,
  goal: VersusResult['goal']
): string {
  const weight = GOAL_WEIGHTS[goal][axis];
  if (weight !== undefined && weight > 0 && LOWER_IS_BETTER.has(axis)) {
    return t(`exerciseVersus.axesProHigher.${axis}`);
  }
  if (weight !== undefined && weight < 0) {
    return t(`exerciseVersus.axesProLower.${axis}`);
  }
  return t(`exerciseVersus.axesPro.${axis}`);
}

function ProList({
  title,
  points,
  empty,
  accent,
  goal,
}: {
  readonly title: string;
  readonly points: readonly VersusPoint[];
  readonly empty: string;
  readonly accent: boolean;
  readonly goal: VersusResult['goal'];
}): ReactNode {
  const { t } = useTranslation();
  const maxDelta = points.reduce((m, p) => Math.max(m, p.delta), 1);
  return (
    <div
      className={cn(
        'border rounded-[var(--radius-base)] p-4 sm:p-5 space-y-3 min-h-[12rem] bg-card',
        accent ? 'border-accent/50' : 'border-rule'
      )}
    >
      <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-label">
        {title}
      </h3>
      {points.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {points.map((p) => (
            <li key={`${p.side}-${p.axis}`} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold text-main">{proAxisLabel(t, p.axis, goal)}</span>
                <span className="font-mono text-[11px] font-bold tabular-nums text-accent shrink-0">
                  {t('exerciseVersus.proDelta', { delta: p.delta })}
                </span>
              </div>
              <div className="h-1.5 bg-progress-track overflow-hidden rounded-full">
                <span
                  className="block h-full rounded-full bg-accent"
                  style={{ width: `${Math.max(8, (p.delta / maxDelta) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AxisRow({
  axis,
  scoreA,
  scoreB,
  weight,
}: {
  readonly axis: VersusAxis;
  readonly scoreA: number;
  readonly scoreB: number;
  readonly weight: number | undefined;
}): ReactNode {
  const { t } = useTranslation();
  const adv = axisAdvantageSide(axis, scoreA, scoreB, weight);
  const lowerBetter =
    (weight !== undefined && weight < 0) ||
    ((weight === undefined || weight === 0) && LOWER_IS_BETTER.has(axis));
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,12rem)_minmax(0,1fr)] sm:grid-cols-[1fr_minmax(0,16rem)_1fr] gap-2 sm:gap-3 items-center">
      <div className="flex items-center justify-end gap-2 min-w-0">
        <span
          className={cn(
            'font-mono text-[11px] tabular-nums shrink-0',
            adv === 'a' ? 'text-accent font-bold' : 'text-muted'
          )}
        >
          {scoreA.toFixed(1)}
        </span>
        <div className="hidden sm:block flex-1 h-1.5 bg-progress-track overflow-hidden rounded-full max-w-[5rem] ml-auto">
          <span
            className={cn(
              'block h-full rounded-full ml-auto',
              adv === 'a' ? 'bg-accent' : 'bg-main/25'
            )}
            style={{ width: `${(scoreA / 10) * 100}%` }}
          />
        </div>
      </div>
      <div className="text-center min-w-0 px-1">
        <span className="block text-[11px] sm:text-xs text-main leading-snug">
          {t(`exerciseVersus.axesTrait.${axis}`)}
        </span>
        {lowerBetter && (
          <span className="block font-mono text-[9px] uppercase tracking-wide text-muted mt-0.5">
            {t('exerciseVersus.lowerIsBetter')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 min-w-0">
        <div className="hidden sm:block flex-1 h-1.5 bg-progress-track overflow-hidden rounded-full max-w-[5rem]">
          <span
            className={cn('block h-full rounded-full', adv === 'b' ? 'bg-accent' : 'bg-main/25')}
            style={{ width: `${(scoreB / 10) * 100}%` }}
          />
        </div>
        <span
          className={cn(
            'font-mono text-[11px] tabular-nums shrink-0',
            adv === 'b' ? 'text-accent font-bold' : 'text-muted'
          )}
        >
          {scoreB.toFixed(1)}
        </span>
      </div>
    </li>
  );
}

function AxisBreakdown({
  scoresA,
  scoresB,
  nameA,
  nameB,
  goal,
}: {
  readonly scoresA: VersusScores;
  readonly scoresB: VersusScores;
  readonly nameA: string;
  readonly nameB: string;
  readonly goal: VersusResult['goal'];
}): ReactNode {
  const { t } = useTranslation();
  const weights = GOAL_WEIGHTS[goal];
  const primary = weightedAxesForGoal(goal);
  return (
    <div
      className="border border-rule rounded-[var(--radius-base)] bg-card p-4 sm:p-5 space-y-4"
      data-testid="versus-axis-breakdown"
    >
      <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-label">
        {t('exerciseVersus.axisBreakdown')}
      </h3>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(7rem,12rem)_minmax(0,1fr)] sm:grid-cols-[1fr_minmax(0,16rem)_1fr] gap-2 sm:gap-3 items-end">
        <p className="text-right font-mono text-[10px] font-bold uppercase tracking-wide text-muted truncate">
          {nameA}
        </p>
        <p className="text-center font-mono text-[10px] font-bold uppercase tracking-wide text-label">
          {t('exerciseVersus.axisColumn')}
        </p>
        <p className="font-mono text-[10px] font-bold uppercase tracking-wide text-muted truncate">
          {nameB}
        </p>
      </div>
      <ul className="space-y-3">
        {primary.map((axis) => (
          <AxisRow
            key={axis}
            axis={axis}
            scoreA={scoresA[axis]}
            scoreB={scoresB[axis]}
            weight={weights[axis]}
          />
        ))}
      </ul>
    </div>
  );
}

export function ExerciseVersusResultView({
  result,
  lang,
}: ExerciseVersusResultViewProps): ReactNode {
  const { t } = useTranslation();
  const nameA = result.exerciseA.name[lang];
  const nameB = result.exerciseB.name[lang];
  const profileA = getVersusProfile(result.exerciseA.exerciseId);
  const profileB = getVersusProfile(result.exerciseB.exerciseId);
  const winnerName = result.outcome === 'a' ? nameA : result.outcome === 'b' ? nameB : null;
  const { aPct, bPct } = scoreShare(result.exerciseA.score, result.exerciseB.score);

  return (
    <section className="space-y-5 anim-rise" data-testid="versus-result" aria-live="polite">
      <div className="relative border border-accent/40 rounded-[var(--radius-base)] bg-card overflow-hidden shadow-[var(--shadow-card)]">
        <div className="relative p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-accent">
              {t(`exerciseVersus.goals.${result.goal}`)}
            </p>
            <span
              className={cn(
                'font-mono text-[10px] font-bold uppercase tracking-[0.08em] px-2.5 py-1 border',
                result.confidence === 'high' && 'border-ok text-ok bg-ok-bg',
                result.confidence === 'medium' && 'border-accent/50 text-accent bg-accent/10',
                result.confidence === 'low' && 'border-rule text-muted bg-surface-2'
              )}
            >
              {t('exerciseVersus.confidence')}:{' '}
              {t(`exerciseVersus.confidenceLevels.${result.confidence}`)}
            </span>
          </div>
          {winnerName !== null ? (
            <div className="space-y-1">
              <p className="chalk-stamp text-accent">{t('exerciseVersus.winnerBadge')}</p>
              <h2 className="font-display text-3xl sm:text-4xl text-title leading-none">
                {winnerName}
              </h2>
            </div>
          ) : (
            <h2 className="font-display text-3xl sm:text-4xl text-title leading-none">
              {t('exerciseVersus.tie')}
            </h2>
          )}
          <div className="space-y-3" data-testid="versus-score-duel">
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end">
              <div className="min-w-0">
                <p className="text-xs text-muted truncate mb-1">{nameA}</p>
                <p
                  className={cn(
                    'font-display-data text-4xl sm:text-5xl tabular-nums leading-none',
                    result.outcome === 'a' ? 'text-accent' : 'text-title'
                  )}
                >
                  {result.exerciseA.score.toFixed(1)}
                </p>
              </div>
              <div className="pb-1 text-center">
                <span className="font-display text-2xl text-muted leading-none">
                  {t('exerciseVersus.vs')}
                </span>
                <p className="font-mono text-[10px] uppercase tracking-wide text-muted mt-1">
                  {t('exerciseVersus.margin')}:{' '}
                  <span className="text-main tabular-nums">{result.scoreMargin.toFixed(1)}</span>
                </p>
              </div>
              <div className="min-w-0 text-right">
                <p className="text-xs text-muted truncate mb-1">{nameB}</p>
                <p
                  className={cn(
                    'font-display-data text-4xl sm:text-5xl tabular-nums leading-none',
                    result.outcome === 'b' ? 'text-accent' : 'text-title'
                  )}
                >
                  {result.exerciseB.score.toFixed(1)}
                </p>
              </div>
            </div>
            <div
              className="flex h-3 overflow-hidden rounded-full bg-progress-track border border-rule"
              role="img"
              aria-label={`${nameA} ${result.exerciseA.score.toFixed(1)}, ${nameB} ${result.exerciseB.score.toFixed(1)}`}
            >
              <span
                className={cn(
                  'h-full transition-[width] duration-500 ease-out',
                  result.outcome === 'a' ? 'bg-accent' : 'bg-main/30'
                )}
                style={{ width: `${aPct}%` }}
              />
              <span
                className={cn(
                  'h-full transition-[width] duration-500 ease-out',
                  result.outcome === 'b' ? 'bg-accent' : 'bg-main/20'
                )}
                style={{ width: `${bPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {profileA !== undefined && profileB !== undefined && (
        <AxisBreakdown
          scoresA={profileA.scores}
          scoresB={profileB.scores}
          nameA={nameA}
          nameB={nameB}
          goal={result.goal}
        />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ProList
          title={t('exerciseVersus.prosFor', { name: nameA })}
          points={result.prosA}
          empty={t('exerciseVersus.noClearPros')}
          accent={result.outcome === 'a'}
          goal={result.goal}
        />
        <ProList
          title={t('exerciseVersus.prosFor', { name: nameB })}
          points={result.prosB}
          empty={t('exerciseVersus.noClearPros')}
          accent={result.outcome === 'b'}
          goal={result.goal}
        />
      </div>

      <div className="border border-rule rounded-[var(--radius-base)] p-4 sm:p-5 space-y-2 bg-card">
        <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-label">
          {t('exerciseVersus.caveats')}
        </h3>
        <ul className="space-y-1.5">
          {result.sharedCaveats.map((c) => (
            <li key={c} className="text-sm text-muted flex gap-2">
              <span className="text-accent shrink-0" aria-hidden="true">
                ·
              </span>
              <span>{t(`exerciseVersus.caveatText.${c}`)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="border border-rule rounded-[var(--radius-base)] p-4 sm:p-5 space-y-3 bg-card">
        <h3 className="font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-label">
          {t('exerciseVersus.evidence')}
        </h3>
        <ol className="space-y-3">
          {result.evidence.map((row, i) => (
            <li
              key={`${row.sourceExerciseId}-${row.reference.doi ?? row.reference.pmid}`}
              className="flex gap-3 text-sm"
            >
              <span className="font-mono text-[11px] font-bold text-accent-deep tabular-nums shrink-0 pt-0.5">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 space-y-0.5">
                <a
                  href={row.reference.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-main hover:text-accent transition-colors"
                >
                  {row.reference.authors} ({row.reference.year}). {row.reference.title}
                </a>
                <span className="block text-xs text-muted">
                  {t(`exerciseVersus.grades.${row.grade}`)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
