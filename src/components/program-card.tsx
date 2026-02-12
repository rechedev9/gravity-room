'use client';

import type { ProgramDefinition } from '@/types/program';

interface ProgramCardProps {
  readonly definition: ProgramDefinition;
  readonly disabled?: boolean;
  readonly disabledLabel?: string;
  readonly onSelect: () => void;
}

const CATEGORY_LABELS: Readonly<Record<string, string>> = {
  strength: 'Strength',
  hypertrophy: 'Hypertrophy',
  powerlifting: 'Powerlifting',
};

export function ProgramCard({
  definition,
  disabled = false,
  disabledLabel = 'Coming Soon',
  onSelect,
}: ProgramCardProps): React.ReactNode {
  const categoryLabel = CATEGORY_LABELS[definition.category] ?? definition.category;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-5 sm:p-6 flex flex-col gap-3 hover:border-[var(--border-light)] transition-colors">
      {/* Header: name + category badge */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm sm:text-base font-extrabold text-[var(--text-header)] leading-tight">
          {definition.name}
        </h3>
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 border border-[var(--border-color)] text-[var(--text-muted)]">
          {categoryLabel}
        </span>
      </div>

      {/* Description */}
      <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-3">
        {definition.description}
      </p>

      {/* Meta: workouts, frequency, author — hidden for placeholder cards */}
      {!disabled && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-info)]">
          <span>{definition.totalWorkouts} workouts</span>
          {definition.workoutsPerWeek > 0 && <span>{definition.workoutsPerWeek}x / week</span>}
          {definition.author && <span>By {definition.author}</span>}
        </div>
      )}

      {/* CTA */}
      <button
        onClick={onSelect}
        disabled={disabled}
        className="mt-auto px-4 py-2.5 text-xs font-bold border-2 border-[var(--btn-border)] bg-[var(--btn-bg)] text-[var(--btn-text)] cursor-pointer transition-all hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)] disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[var(--btn-bg)] disabled:hover:text-[var(--btn-text)]"
      >
        {disabled ? disabledLabel : 'Start Program'}
      </button>
    </div>
  );
}
