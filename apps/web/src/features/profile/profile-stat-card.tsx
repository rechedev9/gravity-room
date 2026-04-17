interface ProfileStatCardProps {
  readonly value: string;
  readonly label: string;
  readonly sublabel?: string;
  readonly accent?: boolean;
  readonly badge?: string;
  readonly badgeVariant?: 'success' | 'neutral';
  readonly progress?: {
    readonly value: number;
    readonly label: string;
  };
  readonly compact?: boolean;
}

const BADGE_STYLES = {
  success: 'bg-ok-bg border-ok-ring text-ok',
  neutral: 'bg-card border-rule text-muted',
} as const;

export function ProfileStatCard({
  value,
  label,
  sublabel,
  accent,
  badge,
  badgeVariant = 'neutral',
  progress,
  compact,
}: ProfileStatCardProps): React.ReactNode {
  return (
    <div
      className={
        compact
          ? `py-2${accent ? ' border-l-2 border-l-heading pl-3' : ''}`
          : `py-3 sm:py-4 border-b border-rule${accent ? ' border-l-2 border-l-heading pl-3' : ''}`
      }
    >
      <div className="flex items-baseline gap-2">
        <p
          className={
            compact
              ? 'font-display-data text-2xl sm:text-3xl text-title leading-none tabular-nums'
              : 'font-display-data text-4xl sm:text-5xl text-title leading-none tabular-nums'
          }
        >
          {value}
        </p>
        {badge && (
          <span
            className={`text-2xs font-bold px-1.5 py-0.5 border rounded-sm ${BADGE_STYLES[badgeVariant]}`}
          >
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs font-semibold text-muted mt-1.5">{label}</p>
      {sublabel && <p className="text-xs text-muted mt-0.5 opacity-70">{sublabel}</p>}
      {progress && (
        <div
          className="h-1.5 bg-progress-track overflow-hidden mt-2"
          role="progressbar"
          aria-valuenow={progress.value}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={progress.label}
        >
          <div
            className="h-full bg-accent transition-[width] duration-300 ease-out progress-fill"
            style={{ width: `${Math.min(100, Math.max(0, progress.value))}%` }}
          />
        </div>
      )}
    </div>
  );
}
