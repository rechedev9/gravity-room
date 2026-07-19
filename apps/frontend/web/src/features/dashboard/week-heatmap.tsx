import { useMemo } from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import {
  buildHeatmapGrid,
  buildMonthLabels,
  buildWeekdayLabels,
  type CompletedWorkout,
  type CellLevel,
} from './week-heatmap-utils';
import { cn } from '@/lib/cn';

// Forged Iron: trained days fill with dim-gold "heat"; a full day flares to bright gold.
const LEVEL_CLASS: Record<CellLevel, string> = {
  empty: 'bg-transparent border-rule',
  partial: 'bg-heat/60 border-heat',
  full: 'bg-accent border-accent-hover',
};

// Legend order, dim → bright, matching the GitHub-style "less → more" ramp.
const LEGEND_LEVELS: readonly CellLevel[] = ['empty', 'partial', 'full'];

// Fixed gutter so the month row, the day grid and the weekday labels all share
// one column origin and stay pixel-aligned across breakpoints.
const GUTTER = 'w-7 shrink-0';

interface WeekHeatmapProps {
  readonly workouts: readonly CompletedWorkout[];
  readonly weeks?: number;
}

export function WeekHeatmap({ workouts, weeks = 12 }: WeekHeatmapProps): React.ReactNode {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  const grid = useMemo(() => buildHeatmapGrid(workouts, new Date(), weeks), [workouts, weeks]);
  const monthLabels = useMemo(() => buildMonthLabels(grid, locale), [grid, locale]);
  const weekdayLabels = useMemo(() => buildWeekdayLabels(locale), [locale]);
  const cellDateFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }),
    [locale]
  );
  const todayKey = new Date().toDateString();

  return (
    <section className="bg-card border border-rule rounded-[var(--radius-base)] p-4 sm:p-5">
      <p className="chalk-stamp mb-3">{t('dashboard.heatmap.title', { weeks })}</p>

      {/* The plot is capped and centered so 12 weeks read as bold, evenly-spread
          squares on desktop while still filling the full width on mobile. */}
      <div className="mx-auto w-full max-w-lg">
        {/* Month labels, aligned above the week they begin. */}
        <div className="flex gap-1" aria-hidden="true">
          <div className={GUTTER} />
          <div
            className="grid flex-1 gap-1"
            style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}
          >
            {monthLabels.map((label, ci) => (
              <span
                key={ci}
                className="text-[10px] leading-none text-muted uppercase tracking-wide truncate"
              >
                {label ?? ''}
              </span>
            ))}
          </div>
        </div>

        {/* Weekday gutter + the day grid itself. */}
        <div className="mt-1.5 flex gap-1" role="grid" aria-label={t('dashboard.heatmap.aria')}>
          <div className={cn('flex flex-col gap-1', GUTTER)} aria-hidden="true">
            {weekdayLabels.map((label, ri) => (
              <span
                key={ri}
                className="flex flex-1 items-center text-[10px] leading-none text-muted"
              >
                {/* Show every other day (Mon/Wed/Fri/Sun) to stay legible on mobile. */}
                {ri % 2 === 0 ? label : ''}
              </span>
            ))}
          </div>

          {grid.map((col, ci) => (
            <motion.div
              key={ci}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: ci * 0.04, duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-1 flex-col gap-1"
              role="row"
            >
              {col.map((cell, ri) => {
                const isToday = cell.date.toDateString() === todayKey;
                const label = t('dashboard.heatmap.cell_title', {
                  date: cellDateFmt.format(cell.date),
                  count: cell.count,
                });
                return (
                  <span
                    key={ri}
                    role="gridcell"
                    aria-label={label}
                    className={cn(
                      'block aspect-square w-full rounded-[2px] border',
                      LEVEL_CLASS[cell.level],
                      isToday && 'ring-1 ring-main'
                    )}
                    title={label}
                  />
                );
              })}
            </motion.div>
          ))}
        </div>

        {/* GitHub-style intensity legend. */}
        <div className="mt-3 flex items-center justify-end gap-1.5">
          <span className="text-[10px] leading-none text-muted">{t('dashboard.heatmap.less')}</span>
          <span
            className="flex items-center gap-1"
            role="img"
            aria-label={t('dashboard.heatmap.legend_aria')}
          >
            {LEGEND_LEVELS.map((level) => (
              <span
                key={level}
                className={cn('block h-3 w-3 rounded-[2px] border', LEVEL_CLASS[level])}
              />
            ))}
          </span>
          <span className="text-[10px] leading-none text-muted">{t('dashboard.heatmap.more')}</span>
        </div>
      </div>
    </section>
  );
}
