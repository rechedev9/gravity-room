import { motion } from 'motion/react';
import { buildHeatmapGrid, type CompletedWorkout, type CellLevel } from './week-heatmap-utils';
import { cn } from '@/lib/cn';

const LEVEL_CLASS: Record<CellLevel, string> = {
  empty: 'bg-transparent border-rule',
  partial: 'bg-accent/30 border-accent/40',
  full: 'bg-accent border-accent',
};

interface WeekHeatmapProps {
  readonly workouts: readonly CompletedWorkout[];
  readonly weeks?: number;
}

export function WeekHeatmap({ workouts, weeks = 12 }: WeekHeatmapProps): React.ReactNode {
  const grid = buildHeatmapGrid(workouts, new Date(), weeks);
  const todayKey = new Date().toDateString();

  return (
    <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-card)] p-4 sm:p-5">
      <p className="chalk-stamp mb-3">ÚLTIMAS {weeks} SEMANAS</p>
      <div className="flex gap-1 overflow-x-auto" role="grid" aria-label="weekly workout heatmap">
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
                  title={`${cell.date.toDateString()} — ${cell.count} workout${cell.count !== 1 ? 's' : ''}`}
                />
              );
            })}
          </motion.div>
        ))}
      </div>
    </section>
  );
}
