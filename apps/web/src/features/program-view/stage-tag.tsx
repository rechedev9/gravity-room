const STAGE_STYLES = [
  'bg-stage-1 text-header border-stage-1',
  'bg-stage-2 text-black border-stage-2',
  'bg-stage-3 text-white border-stage-3',
] as const;

const STAGE_LABELS = ['Normal', 'Precaución', 'Reinicio próximo fallo'] as const;

interface StageTagProps {
  stage: number;
  size?: 'sm' | 'md';
}

export function StageTag({ stage, size = 'sm' }: StageTagProps): React.ReactNode {
  const idx = Math.min(stage, 2);
  const cls = STAGE_STYLES[idx];
  const label = STAGE_LABELS[idx];

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
      title={`Etapa ${stage + 1}: ${label}`}
    >
      S{stage + 1}
    </span>
  );
}
