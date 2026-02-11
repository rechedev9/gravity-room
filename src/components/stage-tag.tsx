'use client';

const STAGE_STYLES = [
  'bg-[var(--stage-s1)] text-white border-[var(--stage-s1)]',
  'bg-[var(--stage-s2)] text-black border-[var(--stage-s2)]',
  'bg-[var(--stage-s3)] text-white border-[var(--stage-s3)]',
] as const;

const STAGE_LABELS = ['Normal', 'Caution', 'Reset next fail'] as const;

interface StageTagProps {
  stage: number;
  size?: 'sm' | 'md';
}

export function StageTag({ stage, size = 'sm' }: StageTagProps): React.ReactNode {
  const idx = Math.min(stage, 2);
  const cls = STAGE_STYLES[idx];
  const label = STAGE_LABELS[idx];

  const sizeClass =
    size === 'md'
      ? 'text-[11px] px-2 py-0.5 border'
      : 'text-[10px] px-1.5 py-px border';

  return (
    <span
      className={`inline-block font-bold ${sizeClass} ${cls}`}
      title={`Stage ${stage + 1}: ${label}`}
    >
      S{stage + 1}
    </span>
  );
}
