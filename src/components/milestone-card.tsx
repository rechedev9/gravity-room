'use client';

import type { Milestone } from '@/lib/profile-stats';

interface MilestoneCardProps {
  readonly milestone: Milestone;
}

export function MilestoneCard({ milestone }: MilestoneCardProps): React.ReactNode {
  return (
    <div
      className={`border p-3 sm:p-4 transition-colors ${
        milestone.earned
          ? 'bg-[var(--bg-card)] border-[var(--fill-progress)] opacity-100'
          : 'bg-[var(--bg-card)] border-[var(--border-color)] opacity-40'
      }`}
    >
      <div className="text-2xl mb-1.5" aria-hidden="true">
        {milestone.icon}
      </div>
      <p className="text-xs font-extrabold text-[var(--text-header)] leading-tight">
        {milestone.title}
      </p>
      <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-snug">
        {milestone.description}
      </p>
    </div>
  );
}
