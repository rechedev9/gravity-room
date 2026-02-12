'use client';

interface ProfileStatCardProps {
  readonly value: string;
  readonly label: string;
  readonly sublabel?: string;
}

export function ProfileStatCard({ value, label, sublabel }: ProfileStatCardProps): React.ReactNode {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 sm:p-5">
      <p className="text-2xl sm:text-3xl font-extrabold text-[var(--text-header)] leading-none">
        {value}
      </p>
      <p className="text-xs font-bold text-[var(--text-muted)] mt-1.5 uppercase tracking-wide">
        {label}
      </p>
      {sublabel && (
        <p className="text-[11px] text-[var(--text-muted)] mt-0.5 opacity-70">{sublabel}</p>
      )}
    </div>
  );
}
