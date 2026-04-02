import { useMemo } from 'react';
import type { InsightItem } from '@/lib/api-functions';
import { isFrequencyPayload } from '@/lib/insight-payloads';
import { formatDateISO } from '@/lib/calendar';

interface FrequencyCardProps {
  readonly insight: InsightItem;
}

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

/**
 * Build a 4-week × 7-day grid from the last 28 calendar days,
 * marking which days had a workout based on the insight payload.
 */
function buildHeatmap(workoutDates: readonly string[]): boolean[][] {
  const dateSet = new Set(workoutDates);
  const today = new Date();
  const grid: boolean[][] = [];

  // Find the Monday 3 weeks ago (start of the 4-week window)
  const todayDay = today.getDay(); // 0=Sun..6=Sat
  const mondayOffset = todayDay === 0 ? 6 : todayDay - 1; // days since last Monday
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - mondayOffset - 21); // 3 full weeks before this Monday

  for (let week = 0; week < 4; week++) {
    const row: boolean[] = [];
    for (let day = 0; day < 7; day++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + week * 7 + day);
      row.push(dateSet.has(formatDateISO(d)));
    }
    grid.push(row);
  }

  return grid;
}

export function FrequencyCard({ insight }: FrequencyCardProps): React.ReactNode {
  const payload = insight.payload;
  if (!isFrequencyPayload(payload)) return null;

  const grid = useMemo(() => buildHeatmap(payload.workoutDates ?? []), [payload.workoutDates]);

  const activeDays = grid.flat().filter(Boolean).length;

  return (
    <div className="bg-card border border-rule card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-[10px] font-bold text-muted uppercase tracking-widest">
          Actividad Semanal
        </h3>
        <span className="font-mono text-[10px] text-muted">{activeDays}/28 días</span>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-1.5">
        {DAY_LABELS.map((label) => (
          <span key={label} className="font-mono text-[8px] text-muted text-center select-none">
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {grid.flat().map((active, i) => (
          <div
            key={i}
            className={
              active
                ? 'aspect-square rounded-sm bg-accent/80'
                : 'aspect-square rounded-sm bg-rule/40'
            }
          />
        ))}
      </div>

      <p className="font-mono text-[9px] text-muted text-right mt-3">
        {payload.totalSessions} sesiones totales
      </p>
    </div>
  );
}
