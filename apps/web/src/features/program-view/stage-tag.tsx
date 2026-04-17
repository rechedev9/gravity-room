import { useTranslation } from 'react-i18next';

const STAGE_STYLES = [
  'bg-stage-1 text-header border-stage-1',
  'bg-stage-2 text-black border-stage-2',
  'bg-stage-3 text-white border-stage-3',
] as const;

const STAGE_LABEL_KEYS = [
  'tracker.stage_tag.labels.normal',
  'tracker.stage_tag.labels.caution',
  'tracker.stage_tag.labels.reset_next_fail',
] as const;

interface StageTagProps {
  readonly stage: number;
  readonly size?: 'sm' | 'md';
}

export function StageTag({ stage, size = 'sm' }: StageTagProps): React.ReactNode {
  const { t } = useTranslation();
  const idx = Math.min(stage, 2);
  const cls = STAGE_STYLES[idx];
  const label = t(STAGE_LABEL_KEYS[idx]);

  const sizeClass = size === 'md' ? 'text-xs px-2 py-0.5 border' : 'text-xs px-1.5 py-px border';

  const glowClass =
    stage === 1
      ? 'shadow-[0_0_8px_rgba(240,112,0,0.25)]'
      : stage >= 2
        ? 'shadow-[0_0_8px_rgba(208,32,32,0.3)]'
        : '';

  return (
    <span
      className={`inline-block font-bold tracking-wider font-mono ${sizeClass} ${cls} ${glowClass}`}
      title={t('tracker.stage_tag.title_template', { n: stage + 1, label })}
    >
      S{stage + 1}
    </span>
  );
}
