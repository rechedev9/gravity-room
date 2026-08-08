import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { CornerTicks } from '@/components/corner-ticks';
import { buttonClassName } from '@/components/button';

export interface NextSet {
  readonly weight: number;
  readonly reps: number;
  readonly label: string;
}

export interface NextWorkout {
  readonly dayIndex: number;
  readonly totalDays?: number;
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
    <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-elevated)] p-8 sm:p-10 text-center">
      <p className="chalk-stamp text-label">{t('dashboard.next_set.no_program')}</p>
      <h1 className="font-display text-5xl sm:text-7xl text-main my-4">
        {t('dashboard.next_set.choose_forge')}
      </h1>
      <p className="text-muted mb-6">{t('dashboard.next_set.empty_body')}</p>
      <Link to="/app/programs" className={buttonClassName({ variant: 'primary' })}>
        {t('dashboard.next_set.view_programs')}
      </Link>
    </section>
  );
}

function DayOneHero({ instance }: { readonly instance: ProgramInstance }): React.ReactNode {
  const { t } = useTranslation();

  return (
    <section className="relative bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-card)] p-6 sm:p-8">
      <CornerTicks />
      <p className="chalk-stamp">{instance.name.toUpperCase()}</p>
      <h1 className="font-display text-4xl sm:text-6xl text-main my-3">
        {t('dashboard.next_set.day_one')}
      </h1>
      <p className="text-muted mb-6">{t('dashboard.next_set.day_one_body')}</p>
      <Link to="/app/tracker" className={buttonClassName({ variant: 'primary' })}>
        {t('dashboard.next_set.start')}
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
        'relative bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-card)] p-5 sm:p-7',
        'transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out-expo)] hover:border-rule-light'
      )}
    >
      <CornerTicks />
      <header className="flex flex-col gap-3 border-b border-rule pb-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="chalk-stamp text-accent">{t('dashboard.next_set.workout_today')}</p>
          <p className="mt-1.5 text-sm font-medium text-main">{nw.focusLifts}</p>
        </div>
        <div className="flex shrink-0 items-center font-mono text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
          <span>
            {nw.totalDays
              ? t('dashboard.next_set.program_progress', {
                  day: nw.dayIndex + 1,
                  total: nw.totalDays,
                })
              : t('dashboard.next_set.today_day', { day: nw.dayIndex + 1 })}
          </span>
        </div>
      </header>
      <p className="chalk-stamp mt-5 text-label">{t('dashboard.next_set.next_set')}</p>
      <h1 className="font-display-data text-5xl sm:text-6xl text-accent leading-none tabular-nums my-2">
        {ns.weight} kg × {ns.reps}
      </h1>
      <p className="text-sm text-muted">{ns.label}</p>
      <div className="flex flex-wrap gap-2 mt-5">
        <Link to="/app/tracker" className={buttonClassName({ variant: 'primary' })}>
          <span aria-hidden="true">▶</span>
          {t('dashboard.next_set.start')}
        </Link>
        <Link to="/app/programs" className={buttonClassName({ variant: 'default' })}>
          {t('dashboard.next_set.view_program')}
        </Link>
      </div>
      {instance.lastSet && (
        <p className="mt-5 pt-4 border-t border-rule text-xs text-muted">
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
