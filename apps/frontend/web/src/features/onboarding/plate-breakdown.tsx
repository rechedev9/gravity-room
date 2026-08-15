import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { computePlateLoading } from '@gzclp/domain/barbell';

export interface PlateBreakdownProps {
  readonly weight: number;
  readonly barWeight?: number;
}

/** How the number on screen turns into plates on the bar. */
export function PlateBreakdown({ weight, barWeight }: PlateBreakdownProps): ReactNode {
  const { t } = useTranslation();
  const loading = computePlateLoading(weight, barWeight);

  if (loading === null) {
    return (
      <p data-testid="plate-breakdown" className="font-mono text-[11px] text-info">
        {t('onboarding.weights.below_bar')}
      </p>
    );
  }

  return (
    <p
      data-testid="plate-breakdown"
      className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-info"
    >
      <span>{t('onboarding.weights.bar', { weight: loading.barWeight })}</span>
      {loading.perSide.length > 0 && <span aria-hidden="true">·</span>}
      {loading.perSide.map((group) => (
        <span key={group.plate} className="border border-rule px-1.5 py-0.5 text-muted">
          {group.count} × {group.plate}
        </span>
      ))}
      {loading.perSide.length > 0 && <span>{t('onboarding.weights.per_side')}</span>}
      {loading.remainder !== 0 && (
        <span className="text-warn">
          {t('onboarding.weights.plate_remainder', { weight: loading.achievedWeight })}
        </span>
      )}
    </p>
  );
}
