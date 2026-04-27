/** Shared volume chart tooltip and label formatter. */

export function formatVolLabel(kg: number): string {
  if (kg >= 1000) return `${(kg / 1000).toFixed(kg % 1000 === 0 ? 0 : 1)}k`;
  return String(kg);
}

interface VolumeTooltipProps {
  readonly active?: boolean;
  readonly payload?: Array<{ value: number; payload: { x: string } }>;
}

export function VolumeTooltip({ active, payload }: VolumeTooltipProps): React.ReactElement | null {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded border px-2 py-1.5 text-xs shadow-lg whitespace-nowrap"
      style={{
        backgroundColor: 'var(--color-card)',
        borderColor: 'var(--color-rule)',
        color: 'var(--color-tooltip-text)',
      }}
    >
      <span className="font-bold">{formatVolLabel(payload[0].value)} kg</span>
      <span className="ml-1 text-[var(--color-muted)]">{payload[0].payload.x}</span>
    </div>
  );
}
