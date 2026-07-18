import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { CornerTicks } from '@/components/corner-ticks';

export interface NextSet {
  readonly weight: number;
  readonly reps: number;
  readonly label: string;
}

export interface NextWorkout {
  readonly dayIndex: number;
  readonly totalDays?: number;
  readonly weekLabel: string;
  readonly focusLifts: string;
}

export interface ProgramInstance {
  readonly id: string;
  readonly programId: string;
  readonly name: string;
  readonly status: string;
  readonly nextWorkout?: NextWorkout;
  readonly nextSet?: NextSet | null;
  readonly results?: Record<string, string>;
  readonly lastSet?: {
    readonly weight: number;
    readonly reps: number;
    readonly deltaFromStart: number;
  };
}

interface NextSetHeroProps {
  readonly programInstance: ProgramInstance | null;
}

export function NextSetHero({ programInstance }: NextSetHeroProps): React.ReactNode {
  if (!programInstance) return <EmptyHero />;
  const { nextSet, results, nextWorkout } = programInstance;
  if (!nextSet || !results || Object.keys(results).length === 0 || !nextWorkout) {
    return <DayOneHero instance={programInstance} />;
  }
  return <FullHero instance={programInstance} nextSet={nextSet} nextWorkout={nextWorkout} />;
}

function EmptyHero(): React.ReactNode {
  const { t } = useTranslation();

  return (
    <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-elevated)] p-8 sm:p-12 text-center">
      <p className="chalk-stamp text-label">{t('dashboard.next_set.no_program')}</p>
      <h1 className="font-display text-5xl sm:text-7xl text-main my-4">
        {t('dashboard.next_set.choose_forge')}
      </h1>
      <p className="text-muted mb-6">{t('dashboard.next_set.empty_body')}</p>
      <Link
        to="/app/programs"
        className="inline-block bg-accent text-on-accent border border-accent-hover rounded-[var(--radius-base)] px-6 py-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] hover:bg-accent-hover active:translate-y-px transition-transform duration-[var(--duration-press)] ease-[var(--ease-press)]"
      >
        {t('dashboard.next_set.view_programs')}
      </Link>
    </section>
  );
}

function DayOneHero({ instance }: { readonly instance: ProgramInstance }): React.ReactNode {
  const { t } = useTranslation();

  return (
    <section className="accent-left-gold relative flex h-full min-h-[360px] flex-col overflow-hidden border border-rule bg-card p-6 sm:p-8">
      <CornerTicks />
      <span
        className="pointer-events-none absolute top-10 right-8 font-display-data text-[112px] leading-none text-rule/30 select-none sm:text-[148px]"
        aria-hidden="true"
      >
        01
      </span>
      <p className="chalk-stamp relative z-10">{t('dashboard.next_set.workout_today')}</p>
      <p className="chalk-stamp relative z-10 mt-6 text-accent">{instance.name.toUpperCase()}</p>
      <h1 className="relative z-10 my-3 font-display text-5xl text-main sm:text-6xl">
        {t('dashboard.next_set.day_one')}
      </h1>
      <p className="relative z-10 mb-6 text-muted">{t('dashboard.next_set.day_one_body')}</p>
      <Link
        to="/app/tracker"
        className="relative z-10 mt-auto inline-block w-fit border border-accent-hover bg-accent px-6 py-3 font-mono text-[11px] font-bold tracking-[0.14em] text-on-accent uppercase transition-transform duration-[var(--duration-press)] ease-[var(--ease-press)] hover:bg-accent-hover active:translate-y-px"
      >
        {t('dashboard.next_set.enter')}
      </Link>
    </section>
  );
}

interface FullHeroProps {
  readonly instance: ProgramInstance;
  readonly nextWorkout: NextWorkout;
  readonly nextSet: NextSet;
}

function FullHero({ instance, nextWorkout: nw, nextSet: ns }: FullHeroProps): React.ReactNode {
  const { t } = useTranslation();

  return (
    <section
      className={cn(
        'accent-left-gold relative flex h-full min-h-[400px] flex-col overflow-hidden border border-rule bg-card p-6 sm:p-8',
        'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-expo)] hover:border-rule-light'
      )}
    >
      <CornerTicks />
      <span
        className="pointer-events-none absolute top-9 right-8 font-display-data text-[112px] leading-none text-rule/30 select-none sm:text-[148px]"
        aria-hidden="true"
      >
        {String(nw.dayIndex + 1).padStart(2, '0')}
      </span>
      <div className="hatch-dim pointer-events-none absolute top-7 right-48 hidden h-6 w-36 opacity-40 sm:block" />
      <p className="chalk-stamp relative z-10">{t('dashboard.next_set.workout_today')}</p>
      <p className="chalk-stamp relative z-10 mt-6 text-accent">
        {t('dashboard.next_set.today_day', { day: nw.dayIndex + 1 })}
        {nw.totalDays ? ` / ${nw.totalDays}` : ''} · {nw.weekLabel}
      </p>
      <h1 className="relative z-10 mt-3 max-w-[75%] font-mono text-sm font-semibold tracking-[0.12em] text-main uppercase sm:text-base">
        {nw.focusLifts}
      </h1>
      <p className="chalk-stamp relative z-10 mt-7 text-label">
        {t('dashboard.next_set.next_set')}
      </p>
      <p className="relative z-10 my-2 font-display-data text-6xl leading-none text-accent tabular-nums sm:text-7xl">
        {ns.weight} kg × {ns.reps}
      </p>
      <p className="relative z-10 text-muted">{ns.label}</p>
      <div className="relative z-10 mt-6 flex flex-wrap gap-3">
        <Link
          to="/app/tracker"
          className="border border-accent-hover bg-accent px-7 py-3.5 font-mono text-[11px] font-bold tracking-[0.14em] text-on-accent uppercase transition-transform duration-[var(--duration-press)] ease-[var(--ease-press)] hover:bg-accent-hover active:translate-y-px"
        >
          ▶ {t('dashboard.next_set.enter')}
        </Link>
      </div>
      {instance.lastSet && (
        <p className="relative z-10 mt-auto border-t border-rule pt-4 text-xs text-muted">
          {t('dashboard.next_set.last_set', {
            weight: instance.lastSet.weight,
            reps: instance.lastSet.reps,
            delta: instance.lastSet.deltaFromStart,
          })}
        </p>
      )}
    </section>
  );
}
