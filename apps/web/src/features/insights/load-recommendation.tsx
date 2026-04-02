import type { InsightItem } from '@/lib/api-functions';
import { isRecommendationPayload } from '@/lib/insight-payloads';

interface LoadRecommendationProps {
  readonly insight: InsightItem;
  readonly exerciseName?: string;
}

export function LoadRecommendation({
  insight,
  exerciseName,
}: LoadRecommendationProps): React.ReactNode {
  const payload = insight.payload;
  if (!isRecommendationPayload(payload)) return null;

  const name = exerciseName ?? insight.exerciseId ?? 'Ejercicio';
  const confidencePct = Math.round(payload.confidence * 100);
  const isML = payload.method === 'logistic_regression';

  return (
    <div
      className="bg-card border border-rule card p-5"
      aria-label={`${name}: ${payload.shouldIncrement ? 'incrementar' : 'mantener'} de ${payload.currentWeight}kg a ${payload.recommendedWeight}kg`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-[10px] font-bold text-muted uppercase tracking-widest">
          {name}
        </h3>
        <span className="font-mono text-[9px] text-muted">{isML ? 'ML' : 'regla'}</span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-1">
            Carga actual
          </p>
          <p className="font-display-data text-2xl text-muted">{payload.currentWeight} kg</p>
        </div>
        <svg
          className={`w-5 h-5 shrink-0 ${payload.shouldIncrement ? 'text-accent animate-pulse' : 'text-muted'}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
        <div className="text-right">
          <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-1">
            {payload.shouldIncrement ? 'Incrementar a' : 'Mantener en'}
          </p>
          <p
            className={`font-display-data text-2xl ${payload.shouldIncrement ? 'text-main' : 'text-title'}`}
          >
            {payload.recommendedWeight} kg
          </p>
        </div>
      </div>
      <div className="flex justify-end mt-3">
        <span
          className={`font-mono text-[9px] px-2 py-0.5 rounded-full border ${
            payload.shouldIncrement ? 'border-main/40 text-main' : 'border-rule text-muted'
          }`}
        >
          {confidencePct}% confianza
        </span>
      </div>
    </div>
  );
}
