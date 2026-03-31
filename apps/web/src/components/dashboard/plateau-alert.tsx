import type { InsightItem } from '@/lib/api-functions';

interface PlateauPayload {
  isPlateauing: boolean;
  confidence: number;
  slope: number;
  currentWeight: number;
  weeksAnalyzed: number;
}

function isPlateauPayload(v: unknown): v is PlateauPayload {
  if (v === null || typeof v !== 'object') return false;
  return (
    'isPlateauing' in v &&
    typeof v.isPlateauing === 'boolean' &&
    'confidence' in v &&
    typeof v.confidence === 'number' &&
    'currentWeight' in v &&
    typeof v.currentWeight === 'number' &&
    'weeksAnalyzed' in v &&
    typeof v.weeksAnalyzed === 'number'
  );
}

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
    <div className="bg-card border border-amber-600/40 card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-mono text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">
            Plateau detectado
          </h3>
          <p className="font-mono text-xs text-muted">
            {name} — {payload.currentWeight} kg sin progresar en {payload.weeksAnalyzed} semanas
          </p>
        </div>
        <span className="font-mono text-[10px] text-amber-500 shrink-0">
          {confidencePct}% conf.
        </span>
      </div>
    </div>
  );
}
