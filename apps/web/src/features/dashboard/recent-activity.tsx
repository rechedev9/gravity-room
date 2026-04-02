import type { GenericWorkoutRow } from '@gzclp/shared/types';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { formatChartDate } from '@/components/charts/chart-theme';

interface RecentActivityProps {
  readonly rows: readonly GenericWorkoutRow[];
  readonly definition: ProgramDefinition;
  readonly resultTimestamps: Readonly<Record<string, string>>;
}

export function RecentActivity({
  rows,
  definition,
  resultTimestamps,
}: RecentActivityProps): React.ReactNode {
  // Last 5 completed workouts — iterate backwards to avoid copying/reversing full array
  const recent: GenericWorkoutRow[] = [];
  for (let i = rows.length - 1; i >= 0 && recent.length < 5; i--) {
    const row = rows[i];
    if (row.slots.every((s) => s.result !== undefined)) {
      recent.push(row);
    }
  }

  if (recent.length === 0) {
    return (
      <p className="text-xs text-muted py-4">
        Completa tu primer entrenamiento para ver la actividad reciente.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {recent.map((row) => {
        const dayIndex = row.index % definition.cycleLength;
        const day = definition.days[dayIndex];
        const ts = resultTimestamps[String(row.index)];
        const dateStr = ts ? formatChartDate(ts) : null;

        const successCount = row.slots.filter((s) => s.result === 'success').length;
        const totalCount = row.slots.length;
        const allSuccess = successCount === totalCount;

        return (
          <li
            key={row.index}
            className="flex items-center gap-3 py-2 border-b border-rule last:border-0"
          >
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: allSuccess ? 'var(--color-ok)' : 'var(--color-fail)' }}
            />
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-main">
                #{row.index + 1} {day?.name ?? ''}
              </span>
            </div>
            <span className="font-mono text-[10px] text-muted whitespace-nowrap">
              {successCount}/{totalCount}
              {dateStr && ` · ${dateStr}`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
