import type { InsightItem } from '@/lib/api-functions';
import { isPlateauPayload } from '@/lib/insight-payloads';

interface PlateauAlertProps {
  readonly insight: InsightItem;
  readonly exerciseName?: string;
}

const CONFIDENCE_THRESHOLD = 0.6;

export function PlateauAlert({ insight, exerciseName }: PlateauAlertProps): React.ReactNode {
  const payload = insight.payload;
  if (!isPlateauPayload(payload)) return null;
  if (!payload.isPlateauing || payload.confidence <= CONFIDENCE_THRESHOLD) return null;

  const name = exerciseName ?? insight.exerciseId ?? 'Ejercicio';
  const confidencePct = Math.round(payload.confidence * 100);

  return (
    <div role="alert" className="bg-amber-500/5 border border-amber-500/60 card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-4 h-4 text-amber-500 shrink-0 mt-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <div>
            <h3 className="font-mono text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">
              Plateau detectado
            </h3>
            <p className="font-mono text-xs text-muted">
              {name} — {payload.currentWeight} kg sin progresar en {payload.weeksAnalyzed} semanas
            </p>
          </div>
        </div>
        <span className="font-mono text-[10px] text-amber-500 shrink-0">
          {confidencePct}% conf.
        </span>
      </div>
    </div>
  );
}
