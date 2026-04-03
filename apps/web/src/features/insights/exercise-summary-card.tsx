import type { InsightItem } from '@/lib/api-functions';
import { isExerciseSummaryPayload } from '@/lib/insight-payloads';
import { formatVolume } from '@/lib/profile-stats';

const SUCCESS_GOOD = 80;
const SUCCESS_OK = 50;

interface ExerciseSummaryCardProps {
  readonly insight: InsightItem;
  readonly exerciseName?: string;
}

export function ExerciseSummaryCard({
  insight,
  exerciseName,
}: ExerciseSummaryCardProps): React.ReactNode {
  const payload = insight.payload;
  if (!isExerciseSummaryPayload(payload)) return null;

  const name = exerciseName ?? insight.exerciseId ?? 'Ejercicio';

  const successTextColor =
    payload.successRate >= SUCCESS_GOOD
      ? 'text-main'
      : payload.successRate >= SUCCESS_OK
        ? 'text-title'
        : 'text-muted';

  const successBgColor =
    payload.successRate >= SUCCESS_GOOD
      ? 'bg-main'
      : payload.successRate >= SUCCESS_OK
        ? 'bg-accent'
        : 'bg-muted';

  return (
    <div className="bg-card border border-rule card p-5">
      <h3 className="font-mono text-[10px] font-bold text-muted uppercase tracking-widest mb-4 truncate">
        {name}
      </h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-0.5">
            Series totales
          </p>
          <p className="font-display-data text-2xl text-title">{payload.totalSets}</p>
        </div>

        <div>
          <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-0.5">
            Tasa de éxito
          </p>
          <p className={`font-display-data text-2xl ${successTextColor}`}>{payload.successRate}%</p>
        </div>

        <div>
          <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-0.5">
            Volumen total
          </p>
          <p className="font-display-data text-2xl text-title">
            {formatVolume(payload.totalVolume)}
            <span className="font-mono text-[9px] text-muted ml-1">kg</span>
          </p>
        </div>

        {payload.avgRpe != null && (
          <div>
            <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-0.5">
              RPE promedio
            </p>
            <p className="font-display-data text-2xl text-title">{payload.avgRpe}</p>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div
          className="h-1.5 rounded-full bg-rule flex-1 overflow-hidden"
          role="progressbar"
          aria-valuenow={payload.successRate}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Tasa de éxito: ${payload.successRate}%`}
        >
          <div
            className={`h-full rounded-full ${successBgColor}`}
            style={{ width: `${payload.successRate}%` }}
          />
        </div>
        <span className="font-mono text-[9px] text-muted shrink-0">
          {payload.successSets}/{payload.totalSets}
        </span>
      </div>
    </div>
  );
}
