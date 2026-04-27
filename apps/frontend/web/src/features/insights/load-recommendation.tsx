import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const payload = insight.payload;
  if (!isRecommendationPayload(payload)) return null;

  const name = exerciseName ?? insight.exerciseId ?? t('insights.load_rec.default_exercise');
  const confidencePct = Math.round(payload.confidence * 100);
  const isML = payload.method === 'logistic_regression';
  const actionLabel = payload.shouldIncrement
    ? t('insights.load_rec.action_increment')
    : t('insights.load_rec.action_maintain');

  return (
    <div
      className="bg-card border border-rule card p-5"
      aria-label={`${name}: ${actionLabel} ${t('insights.load_rec.from')} ${payload.currentWeight}kg ${t('insights.load_rec.to')} ${payload.recommendedWeight}kg`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-mono text-[10px] font-bold text-muted uppercase tracking-widest">
          {name}
        </h3>
        <span className="font-mono text-[9px] text-muted">
          {isML ? 'ML' : t('insights.load_rec.rule_method_label')}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[9px] text-muted uppercase tracking-widest mb-1">
            {t('insights.load_rec.current_load_label')}
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
            {payload.shouldIncrement
              ? t('insights.load_rec.increment_to_label')
              : t('insights.load_rec.maintain_at_label')}
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
          {confidencePct}% {t('insights.load_rec.confidence_label')}
        </span>
      </div>
    </div>
  );
}
