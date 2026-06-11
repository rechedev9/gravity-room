import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { buildHeatmapGrid, type CompletedWorkout, type CellLevel } from './week-heatmap-utils';
import { cn } from '@/lib/cn';

// Forged Iron: trained days fill with dim-gold "heat"; a full day flares to bright gold.
const LEVEL_CLASS: Record<CellLevel, string> = {
  empty: 'bg-transparent border-rule',
  partial: 'bg-heat/60 border-heat',
  full: 'bg-accent border-accent-hover',
};

interface WeekHeatmapProps {
  readonly workouts: readonly CompletedWorkout[];
  readonly weeks?: number;
}

export function WeekHeatmap({ workouts, weeks = 12 }: WeekHeatmapProps): React.ReactNode {
  const { t } = useTranslation();
  const grid = buildHeatmapGrid(workouts, new Date(), weeks);
  const todayKey = new Date().toDateString();

  return (
    <section className="bg-card border border-rule rounded-[var(--radius-base)] p-4 sm:p-5">
      <p className="chalk-stamp mb-3">{t('dashboard.heatmap.title', { weeks })}</p>
      <div
        className="flex gap-1 overflow-x-auto"
        role="grid"
        aria-label={t('dashboard.heatmap.aria')}
      >
        {grid.map((col, ci) => (
          <motion.div
            key={ci}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: ci * 0.04, duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-1"
            role="row"
          >
            {col.map((cell, ri) => {
              const isToday = cell.date.toDateString() === todayKey;
              return (
                <span
                  key={ri}
                  role="gridcell"
                  className={cn(
                    'block w-3.5 h-3.5 border rounded-[1px]',
                    LEVEL_CLASS[cell.level],
                    isToday && 'ring-1 ring-main'
                  )}
                  title={t('dashboard.heatmap.cell_title', {
                    date: cell.date.toDateString(),
                    count: cell.count,
                  })}
                />
              );
            })}
          </motion.div>
        ))}
      </div>
    </section>
  );
}
