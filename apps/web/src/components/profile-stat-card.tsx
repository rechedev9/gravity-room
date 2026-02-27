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
}: ProfileStatCardProps): React.ReactNode {
  return (
    <div
      className={`bg-card border border-rule p-4 sm:p-5 card edge-glow-top${accent ? ' border-l-2 border-l-heading' : ''}`}
    >
      <div className="flex items-baseline gap-2">
        <p
          className="font-display-data text-4xl sm:text-5xl text-heading leading-none"
          style={{ textShadow: '0 0 20px rgba(240, 192, 64, 0.15)' }}
        >
          {value}
        </p>
        {badge && (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 border rounded-sm ${BADGE_STYLES[badgeVariant]}`}
          >
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs font-bold text-muted mt-1.5 uppercase tracking-wide">{label}</p>
      {sublabel && <p className="text-[11px] text-muted mt-0.5 opacity-70">{sublabel}</p>}
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
