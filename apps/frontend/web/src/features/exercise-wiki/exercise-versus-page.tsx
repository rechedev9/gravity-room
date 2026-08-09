import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { ArticleLang } from '@gzclp/domain/schemas/exercise-article';
import type { VersusGoal, VersusResult } from '@gzclp/domain/schemas/exercise-versus';
import { VersusGoalSchema } from '@gzclp/domain/schemas/exercise-versus';
import { compareExercises } from '@gzclp/domain/exercise-versus';
import { listVersusProfiles } from '@gzclp/domain/exercise-versus-profiles';
import { useHead } from '@/hooks/use-head';
import { Button } from '@/components/button';
import { cn } from '@/lib/cn';
import { ExerciseVersusResultView } from './exercise-versus-result';

const GOALS = VersusGoalSchema.options;
const APP_BASE = '/app/exercises/versus';

const selectClassName =
  'w-full h-12 px-3 border-2 border-rule bg-body text-main text-sm cursor-pointer focus:outline-none focus-visible:ring-2 ring-accent focus:border-accent transition-colors';

interface ExerciseVersusPageProps {
  readonly lang: ArticleLang;
  readonly inApp?: boolean;
}

export function ExerciseVersusPage({ lang, inApp = false }: ExerciseVersusPageProps): ReactNode {
  const { t } = useTranslation();
  const profiles = useMemo(() => listVersusProfiles('chest'), []);
  const [exerciseA, setExerciseA] = useState(profiles[0]?.exerciseId ?? 'bench');
  const [exerciseB, setExerciseB] = useState(profiles[2]?.exerciseId ?? 'decline-bench');
  const [goal, setGoal] = useState<VersusGoal>('general_chest_hypertrophy');
  const [result, setResult] = useState<VersusResult | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const goalRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const publicPath = lang === 'es' ? '/ejercicios/versus' : '/en/exercises/versus';
  const backTo = inApp ? '/app/exercises' : lang === 'es' ? '/ejercicios' : '/en/exercises';

  useHead({
    title: t('exerciseVersus.metaTitle'),
    description: t('exerciseVersus.metaDescription'),
    canonical: `https://gravityroom.app${publicPath}`,
    lang,
  });

  const options = profiles.map((p) => ({
    value: p.exerciseId,
    label: p.name[lang],
  }));

  function clearResult(): void {
    setResult(null);
    setErrorKey(null);
  }

  function runCompare(): void {
    setErrorKey(null);
    const compared = compareExercises(exerciseA, exerciseB, goal);
    if (!compared.ok) {
      setResult(null);
      setErrorKey(`exerciseVersus.errors.${compared.code}`);
      return;
    }
    setResult(compared.result);
  }

  function swapSides(): void {
    setExerciseA(exerciseB);
    setExerciseB(exerciseA);
    clearResult();
  }

  function selectGoal(next: VersusGoal): void {
    setGoal(next);
    clearResult();
  }

  function handleGoalKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    let nextIndex: number | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % GOALS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + GOALS.length) % GOALS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = GOALS.length - 1;
    }
    if (nextIndex === undefined) return;
    event.preventDefault();
    const nextGoal = GOALS[nextIndex];
    if (nextGoal === undefined) return;
    goalRefs.current[nextIndex]?.focus();
    selectGoal(nextGoal);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <Link
        to={backTo}
        className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-muted hover:text-main transition-colors"
      >
        <span aria-hidden="true">&larr;</span>
        {t('exerciseVersus.back')}
      </Link>

      <header className="space-y-3">
        <p className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-accent">
          {t('exerciseVersus.kicker')}
        </p>
        <h1 className="font-display text-4xl sm:text-5xl text-title tracking-[0.04em]">
          {t('exerciseVersus.heading')}
        </h1>
        <p className="text-muted max-w-2xl leading-relaxed">{t('exerciseVersus.intro')}</p>
        <div className="h-px w-24 bg-accent origin-left anim-rule" aria-hidden="true" />
      </header>

      <form
        className="relative border border-rule rounded-[var(--radius-base)] bg-card shadow-[var(--shadow-card)] overflow-hidden"
        onSubmit={(e) => {
          e.preventDefault();
          runCompare();
        }}
      >
        <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr]">
          <Corner
            side="A"
            label={t('exerciseVersus.exerciseA')}
            value={exerciseA}
            otherValue={exerciseB}
            options={options}
            testId="versus-exercise-a"
            onChange={(id) => {
              setExerciseA(id);
              clearResult();
            }}
          />

          <div className="relative flex flex-col items-center justify-center gap-3 py-4 lg:py-0 lg:px-2 border-y lg:border-y-0 lg:border-x border-rule bg-surface-2">
            <span
              className="font-display text-5xl sm:text-6xl text-accent leading-none select-none"
              aria-hidden="true"
            >
              {t('exerciseVersus.vs')}
            </span>
            <button
              type="button"
              onClick={swapSides}
              className="font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-muted hover:text-accent border border-rule hover:border-accent px-3 py-1.5 min-h-11 transition-colors cursor-pointer focus-visible:ring-2 ring-accent focus-visible:outline-none"
              data-testid="versus-swap"
            >
              {t('exerciseVersus.swap')}
            </button>
          </div>

          <Corner
            side="B"
            label={t('exerciseVersus.exerciseB')}
            value={exerciseB}
            otherValue={exerciseA}
            options={options}
            testId="versus-exercise-b"
            align="end"
            onChange={(id) => {
              setExerciseB(id);
              clearResult();
            }}
          />
        </div>

        <div className="relative border-t border-rule p-4 sm:p-5 space-y-4 bg-surface-2/40">
          <div className="space-y-2">
            <span
              className="block text-xs font-bold uppercase tracking-wide text-label"
              id="versus-goal-label"
            >
              {t('exerciseVersus.goal')}
            </span>
            <div
              className="flex flex-wrap gap-2"
              role="radiogroup"
              aria-labelledby="versus-goal-label"
              data-testid="versus-goal"
            >
              {GOALS.map((g, index) => {
                const selected = goal === g;
                return (
                  <button
                    key={g}
                    ref={(el) => {
                      goalRefs.current[index] = el;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => selectGoal(g)}
                    onKeyDown={(event) => handleGoalKeyDown(event, index)}
                    className={cn(
                      'font-mono text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.05em]',
                      'min-h-11 px-3 py-2 border rounded-[var(--radius-base)] transition-colors cursor-pointer',
                      'focus-visible:ring-2 ring-accent focus-visible:outline-none',
                      selected
                        ? 'bg-accent text-on-accent border-accent-hover'
                        : 'bg-card text-muted border-rule hover:border-accent hover:text-main'
                    )}
                  >
                    {t(`exerciseVersus.goals.${g}`)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="submit" variant="primary" data-testid="versus-submit">
              {t('exerciseVersus.compare')}
            </Button>
            <p className="text-xs text-muted">{t('exerciseVersus.mvpNote')}</p>
          </div>

          {errorKey !== null && (
            <p role="alert" className="text-sm font-bold text-error" data-testid="versus-error">
              {t(errorKey)}
            </p>
          )}
        </div>
      </form>

      {result !== null && <ExerciseVersusResultView result={result} lang={lang} />}
    </div>
  );
}

function Corner({
  side,
  label,
  value,
  otherValue,
  options,
  testId,
  onChange,
  align = 'start',
}: {
  readonly side: 'A' | 'B';
  readonly label: string;
  readonly value: string;
  readonly otherValue: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly testId: string;
  readonly onChange: (id: string) => void;
  readonly align?: 'start' | 'end';
}): ReactNode {
  return (
    <div className={cn('relative p-5 sm:p-6 space-y-4', align === 'end' && 'lg:text-right')}>
      <div className={cn('flex items-center gap-3', align === 'end' && 'lg:flex-row-reverse')}>
        <span
          className={cn(
            'inline-flex h-10 w-10 shrink-0 items-center justify-center',
            'font-display text-xl text-on-accent bg-accent border border-accent-hover',
            'shadow-[var(--shadow-pressed-steel)]'
          )}
          aria-hidden="true"
        >
          {side}
        </span>
        <span className="block text-xs font-bold uppercase tracking-wide text-label">{label}</span>
      </div>
      <label className="block space-y-1.5">
        <span className="sr-only">{label}</span>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(selectClassName, align === 'end' && 'lg:text-right')}
          data-testid={testId}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.value === otherValue}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function AppExerciseVersusPage(): ReactNode {
  const { i18n } = useTranslation();
  const lang: ArticleLang = i18n.language.startsWith('en') ? 'en' : 'es';
  return <ExerciseVersusPage lang={lang} inApp />;
}

export const EXERCISE_VERSUS_APP_PATH = APP_BASE;
