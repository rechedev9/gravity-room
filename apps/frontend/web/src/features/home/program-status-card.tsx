import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Kicker } from '@/components/kicker';

interface ProgramStatusCardProps {
  readonly programName: string;
  readonly currentDay: number;
  readonly totalWorkouts: number;
  readonly weekSessions: number;
  readonly weeklyTarget: number;
  readonly streakDays: number;
  readonly workoutDates: readonly string[];
  readonly pristine: boolean;
}

function mondayStart(now: Date): Date {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const offset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - offset);
  return start;
}

export function buildCurrentWeekActivity(
  workoutDates: readonly string[],
  now = new Date()
): readonly boolean[] {
  const start = mondayStart(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const activity = Array.from({ length: 7 }, () => false);

  for (const rawDate of workoutDates) {
    const date = new Date(rawDate);
    if (Number.isNaN(date.getTime()) || date < start || date >= end) continue;
    const index = (date.getDay() + 6) % 7;
    activity[index] = true;
  }

  return activity;
}

export function ProgramStatusCard({
  programName,
  currentDay,
  totalWorkouts,
  weekSessions,
  weeklyTarget,
  streakDays,
  workoutDates,
  pristine,
}: ProgramStatusCardProps): React.ReactNode {
  const { t } = useTranslation();
  const safeTotal = Math.max(1, totalWorkouts);
  const safeCurrent = Math.min(Math.max(1, currentDay), safeTotal);
  const progress = (safeCurrent / safeTotal) * 100;
  const weekdays = t('home.program_card.weekdays', { returnObjects: true });
  const dayLabels = Array.isArray(weekdays)
    ? weekdays.filter((day): day is string => typeof day === 'string').slice(0, 7)
    : [];
  const activity = buildCurrentWeekActivity(workoutDates);

  return (
    <section className="flex h-full flex-col border border-rule bg-card p-5 sm:p-6">
      <div>
        <Kicker noRule className="mb-4">
          {t('home.program_card.title')}
        </Kicker>
        <p className="mb-1 truncate text-sm font-semibold text-main">{programName}</p>
        <p className="font-display-data text-3xl text-title">
          {t('home.program_card.day_progress', { current: safeCurrent, total: safeTotal })}
        </p>
        <div
          className="mt-3 h-2 overflow-hidden border border-rule bg-progress-track"
          role="progressbar"
          aria-label={t('home.program_card.progress_aria', {
            current: safeCurrent,
            total: safeTotal,
          })}
          aria-valuemin={0}
          aria-valuemax={safeTotal}
          aria-valuenow={safeCurrent}
        >
          <div className="h-full bg-accent" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-3 font-mono text-[11px] text-muted">
          {t('home.program_card.week_sessions', {
            completed: weekSessions,
            target: weeklyTarget,
          })}
        </p>
      </div>

      <div className="mt-5 border-t border-rule pt-5">
        <p className="font-mono text-[10px] tracking-wider text-label uppercase">
          {t('home.program_card.current_streak')}
        </p>
        <p className="mt-1 font-display-data text-3xl text-accent">
          {streakDays}{' '}
          <span className="font-sans text-sm font-normal text-muted">
            {t('home.program_card.days', { count: streakDays })}
          </span>
        </p>
        <div className="mt-5 grid grid-cols-7 gap-2" aria-label={t('home.program_card.week_aria')}>
          {activity.map((trained, index) => (
            <div key={dayLabels[index] ?? index} className="text-center">
              <span className="mb-2 block font-mono text-[9px] text-label">
                {dayLabels[index] ?? '·'}
              </span>
              <span
                className={`mx-auto block h-5 w-5 rounded-full border ${
                  trained ? 'border-accent bg-accent' : 'border-rule-light bg-transparent'
                }`}
                aria-hidden="true"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto border-t border-rule pt-5">
        {pristine && (
          <div className="mb-4">
            <p className="font-mono text-[10px] tracking-[0.16em] text-accent uppercase">
              {t('home.pristine.kicker')}
            </p>
            <p className="mt-2 text-sm font-semibold text-main">{t('home.pristine.title')}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">{t('home.pristine.body')}</p>
          </div>
        )}
        <Link
          to="/app/programs"
          className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.12em] text-accent uppercase hover:text-accent-hover focus-visible:outline-none focus-visible:underline"
        >
          {t('home.program_card.view_program')}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}
