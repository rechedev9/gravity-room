import { useEffect, useMemo } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { findFirstPendingIndex } from '@gzclp/domain/generic-stats';
import type { GenericWorkoutRow } from '@gzclp/domain/types';
import { Kbd } from '@/components/ui/kbd';
import { Panel } from '@/components/ui/panel';
import { TierBadge, type Tier } from '@/components/ui/tier-badge';
import { useLocaleWeight } from '@/hooks/use-locale-weight';
import type { ProgramProgress, RecentSessionRow } from '@/features/dashboard/dashboard-view-models';
import type { PrRoad } from '@/features/dashboard/use-pr-road';
import {
  buildLastSession,
  buildStageWarning,
  buildT1Loads,
  buildTodaySlots,
  buildWeekStrip,
  formatRest,
} from './desktop-home-view-models';

/** Domain slots carry lowercase tier ids ("t1"); the badge wants the label form. */
function asTier(value: string): Tier | null {
  switch (value.toUpperCase()) {
    case 'T1':
      return 'T1';
    case 'T2':
      return 'T2';
    case 'T3':
      return 'T3';
    default:
      return null;
  }
}

function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

/** A flat 80×28 polyline; a single point draws a horizontal line. */
function sparklinePoints(series: readonly number[]): string {
  if (series.length === 0) return '';
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = max - min;
  return series
    .map((value, index) => {
      const x = series.length === 1 ? 40 : 2 + (index * 76) / (series.length - 1);
      const y = span === 0 ? 14 : 24 - ((value - min) / span) * 20;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export interface DesktopHomeProps {
  readonly programName: string;
  readonly progress: ProgramProgress;
  readonly rows: readonly GenericWorkoutRow[];
  readonly workoutDates: readonly string[];
  readonly resultTimestamps: Readonly<Record<string, string>>;
  readonly recentSessions: readonly RecentSessionRow[];
  readonly milestone: PrRoad | null;
  readonly totalSessions: number;
  readonly totalVolume: number;
  readonly workoutsPerWeek: number;
}

/**
 * Home at lg+, per artboard 01: greeting over real data, today's session and the
 * week on the left, milestones, last session and program totals on the right.
 * Home below lg keeps the existing stacked dashboard.
 */
export function DesktopHome({
  programName,
  progress,
  rows,
  workoutDates,
  resultTimestamps,
  recentSessions,
  milestone,
  totalSessions,
  totalVolume,
  workoutsPerWeek,
}: DesktopHomeProps): React.ReactNode {
  const { t, i18n } = useTranslation();
  const { formatWeight, formatNumber } = useLocaleWeight();
  const navigate = useNavigate();
  const lang = i18n.language;

  const pendingIndex = useMemo(() => findFirstPendingIndex(rows), [rows]);
  const todaySlots = useMemo(
    () => buildTodaySlots(pendingIndex >= 0 ? rows[pendingIndex] : undefined),
    [rows, pendingIndex]
  );
  const week = useMemo(() => buildWeekStrip(workoutDates, new Date(), lang), [workoutDates, lang]);
  const loads = useMemo(() => buildT1Loads(rows), [rows]);
  const warning = useMemo(() => buildStageWarning(rows), [rows]);
  const lastSession = useMemo(
    () => buildLastSession(rows, resultTimestamps),
    [rows, resultTimestamps]
  );
  const lastSummary = recentSessions[0];

  const weekday = capitalize(new Intl.DateTimeFormat(lang, { weekday: 'long' }).format(new Date()));
  const focusLift = todaySlots[0]?.name ?? loads[0]?.lift ?? null;
  const sessionsThisWeek = workoutsPerWeek > 0 ? workoutsPerWeek : week.doneThisWeek;

  // Enter on the untouched page opens the tracker, matching the button's hint.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Enter' || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.target instanceof HTMLElement) {
        const tag = event.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON') return;
      }
      if (document.activeElement !== document.body) return;
      void navigate({ to: '/app/tracker' });
    };
    document.addEventListener('keydown', onKeyDown);
    return (): void => document.removeEventListener('keydown', onKeyDown);
  }, [navigate]);

  return (
    <div className="mx-auto w-full max-w-[1180px] px-6 py-6">
      <p className="text-lg text-main" data-testid="desktop-home-greeting">
        {focusLift === null
          ? t('home.desktop.greeting_done', { weekday })
          : t('home.desktop.greeting', { weekday, lift: focusLift })}
      </p>
      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-label">
        {t('home.desktop.week_summary', {
          done: week.doneThisWeek,
          total: sessionsThisWeek,
        })}
      </p>

      <div className="mt-5 grid grid-cols-12 items-start gap-4">
        <div className="col-span-8 flex flex-col gap-4">
          <Panel title={t('home.desktop.today_title', { day: progress.day })} meta={programName}>
            {todaySlots.length === 0 ? (
              <p className="text-sm text-muted">{t('home.desktop.all_done')}</p>
            ) : (
              <>
                <ul className="flex flex-col divide-y divide-rule">
                  {todaySlots.map((slot) => {
                    const tier = asTier(slot.tier);
                    return (
                      <li
                        key={slot.id}
                        className="grid grid-cols-[44px_1fr_auto_auto] items-center gap-3 py-2.5"
                      >
                        <span>
                          {tier === null ? slot.tier.toUpperCase() : <TierBadge tier={tier} />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-main">
                            {slot.name}
                          </span>
                          <span className="block font-mono text-[11px] text-label">
                            {slot.scheme}
                            {slot.scheme.endsWith('+') ? ' · AMRAP' : ''}
                          </span>
                        </span>
                        <span className="text-right font-mono text-sm text-main">
                          {slot.weight > 0 ? formatWeight(slot.weight) : '—'}
                        </span>
                        <span className="text-right font-mono text-[11px] text-label">
                          {t('home.desktop.rest', { time: formatRest(slot.restSeconds) })}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <Link
                  to="/app/tracker"
                  className="type-button mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-control bg-accent px-4 text-on-accent transition-colors hover:bg-accent-hover sm:w-auto"
                >
                  {t('home.desktop.start')}
                  <Kbd className="border-on-accent/40 text-on-accent">Enter</Kbd>
                </Link>
              </>
            )}
          </Panel>

          <Panel
            title={t('home.desktop.week_title')}
            meta={t('home.desktop.week_meta', {
              done: week.doneThisWeek,
              total: sessionsThisWeek,
            })}
          >
            <ol className="grid grid-cols-7 gap-2">
              {week.days.map((day) => (
                <li key={day.key} className="flex flex-col items-center gap-1.5">
                  <span className="font-mono text-[11px] uppercase text-label">{day.label}</span>
                  <span
                    aria-hidden="true"
                    className={
                      day.state === 'done'
                        ? 'block size-2.5 rounded-full bg-accent'
                        : day.state === 'today'
                          ? 'block size-2.5 rounded-full border-2 border-accent'
                          : 'block size-2.5 rounded-full border border-rule-light'
                    }
                  />
                </li>
              ))}
            </ol>
          </Panel>

          {loads.length > 0 && (
            <Panel title={t('home.desktop.loads_title')} meta={t('home.desktop.loads_meta')}>
              <div className="grid grid-cols-2 gap-3">
                {loads.map((load) => (
                  <div key={load.id} className="rounded-control border border-rule px-3 py-2">
                    <span className="block truncate text-[13px] font-semibold text-main">
                      {load.lift}
                    </span>
                    <div className="flex items-end justify-between gap-2">
                      <span className="font-mono text-sm text-accent">
                        {formatWeight(load.weight)}
                      </span>
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 80 28"
                        className="h-7 w-20 shrink-0"
                        preserveAspectRatio="none"
                      >
                        <polyline
                          points={sparklinePoints(load.series)}
                          fill="none"
                          stroke="var(--color-accent)"
                          strokeWidth="2"
                        />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
              {warning !== null && (
                <p className="mt-3 flex items-start gap-2 text-[13px] text-warn">
                  <span aria-hidden="true">⚠</span>
                  <span>
                    {t('home.desktop.stage_warning', {
                      lift: warning.lift,
                      scheme: warning.scheme,
                      day: warning.day,
                    })}
                  </span>
                </p>
              )}
            </Panel>
          )}
        </div>

        <div className="col-span-4 flex flex-col gap-4">
          <Panel
            title={t('home.desktop.milestone_title')}
            meta={milestone === null ? undefined : `${Math.round(milestone.pctTowardPr)} %`}
          >
            {milestone === null ? (
              <p className="text-sm text-muted">{t('home.desktop.no_milestone')}</p>
            ) : (
              <>
                <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-label">
                  {t('home.desktop.milestone_goal', {
                    lift: milestone.lift,
                    current: formatWeight(milestone.current),
                    target: formatWeight(milestone.target),
                  })}
                </p>
                <span className="mt-2 block h-1.5 overflow-hidden rounded-[3px] bg-surface-2">
                  <span
                    className="block h-full bg-accent"
                    style={{ width: `${Math.min(100, Math.max(0, milestone.pctTowardPr))}%` }}
                  />
                </span>
                <p className="mt-2 text-[13px] text-muted">
                  {t('home.desktop.milestone_delta', {
                    pct: Math.round(milestone.pctTowardPr),
                    delta: formatWeight(milestone.deltaToPr),
                  })}
                </p>
              </>
            )}
          </Panel>

          <Panel
            title={t('home.desktop.last_title')}
            meta={
              lastSession === null
                ? undefined
                : t('home.desktop.last_meta', {
                    day: lastSession.day,
                    date: lastSummary?.dateLabel ?? lastSession.dateLabel,
                  })
            }
          >
            {lastSession === null ? (
              <p className="text-sm text-muted">{t('home.desktop.no_last')}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {lastSession.slots.map((slot) => {
                  const tier = asTier(slot.tier);
                  return (
                    <li key={slot.id} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-[13px] text-muted">
                        <span className="mr-2 inline-block w-6 font-mono text-[11px] text-label">
                          {tier ?? slot.tier.toUpperCase()}
                        </span>
                        {slot.name}
                      </span>
                      <span className="shrink-0 font-mono text-[13px] text-main">
                        {slot.weight > 0
                          ? t('home.desktop.last_value', {
                              weight: formatWeight(slot.weight),
                              reps: formatNumber(slot.reps),
                            })
                          : t('home.desktop.last_reps_only', { reps: formatNumber(slot.reps) })}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title={t('home.desktop.program_title')} meta={programName}>
            <dl className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[13px] text-muted">{t('home.desktop.sessions')}</dt>
                <dd className="font-mono text-lg text-main">
                  {formatNumber(totalSessions)}
                  <span className="text-[11px] text-label">
                    {' '}
                    / {formatNumber(progress.totalDays)}
                  </span>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[13px] text-muted">{t('home.desktop.week')}</dt>
                <dd className="font-mono text-sm text-main">
                  {t('home.desktop.week_value', {
                    week: progress.week,
                    total: Math.max(
                      1,
                      Math.ceil(progress.totalDays / Math.max(1, workoutsPerWeek))
                    ),
                  })}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[13px] text-muted">{t('home.desktop.volume')}</dt>
                <dd className="font-mono text-sm text-main">
                  {formatNumber(Math.round(totalVolume))} kg
                </dd>
              </div>
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  );
}
