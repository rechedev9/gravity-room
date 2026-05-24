import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

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
        className="inline-block bg-accent text-on-accent border-[1.5px] border-accent rounded-[var(--radius-base)] px-6 py-3 font-bold uppercase tracking-wide hover:bg-accent-hover active:translate-y-px transition-transform duration-[var(--duration-press)] ease-[var(--ease-press)]"
      >
        {t('dashboard.next_set.view_programs')}
      </Link>
    </section>
  );
}

function DayOneHero({ instance }: { readonly instance: ProgramInstance }): React.ReactNode {
  const { t } = useTranslation();

  return (
    <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-elevated)] p-6 sm:p-8">
      <p className="chalk-stamp">{instance.name.toUpperCase()}</p>
      <h1 className="font-display text-4xl sm:text-6xl text-main my-3">
        {t('dashboard.next_set.day_one')}
      </h1>
      <p className="text-muted mb-6">{t('dashboard.next_set.day_one_body')}</p>
      <Link
        to="/app/tracker"
        className="inline-block bg-accent text-on-accent border-[1.5px] border-accent rounded-[var(--radius-base)] px-6 py-3 font-bold uppercase tracking-wide hover:bg-accent-hover active:translate-y-px transition-transform duration-[var(--duration-press)] ease-[var(--ease-press)]"
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
        'bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-elevated)] p-6 sm:p-8',
        'transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out-expo)] hover:-translate-y-[2px]'
      )}
    >
      <p className="chalk-stamp">
        {t('dashboard.next_set.today_day', { day: nw.dayIndex + 1 })}
        {nw.totalDays ? ` / ${nw.totalDays}` : ''} · {nw.weekLabel} · {nw.focusLifts.toUpperCase()}
      </p>
      <p className="chalk-stamp mt-6 text-label">{t('dashboard.next_set.next_set')}</p>
      <p className="font-display-data text-5xl sm:text-7xl text-main leading-none tabular-nums my-2">
        {ns.weight} kg × {ns.reps}
      </p>
      <p className="text-muted">{ns.label}</p>
      <div className="flex flex-wrap gap-3 mt-6">
        <Link
          to="/app/tracker"
          className="bg-accent text-on-accent border-[1.5px] border-accent rounded-[var(--radius-base)] px-6 py-3 font-bold uppercase tracking-wide hover:bg-accent-hover active:translate-y-px transition-transform duration-[var(--duration-press)] ease-[var(--ease-press)]"
        >
          ▶ {t('dashboard.next_set.enter')}
        </Link>
        <button
          type="button"
          className="font-mono text-xs text-muted uppercase tracking-widest px-3 py-2 hover:text-main"
        >
          {t('dashboard.next_set.not_today')}
        </button>
      </div>
      {instance.lastSet && (
        <p className="mt-6 pt-4 border-t border-rule text-xs text-muted">
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
