import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import type { CatalogEntry } from '@gzclp/domain/schemas/catalog';
import type { ProgramLevel } from '@gzclp/domain/catalog';
import { localizedProgramDescription, localizedProgramName } from '@/lib/catalog-display';

const LEVEL_LABEL_KEYS: Readonly<Record<ProgramLevel, string>> = {
  beginner: 'programs.card.level_beginner',
  intermediate: 'programs.card.level_intermediate',
  advanced: 'programs.card.level_advanced',
};

export interface StepProgramProps {
  readonly entries: readonly CatalogEntry[];
  readonly selectedId: string | null;
  readonly onSelect: (programId: string) => void;
  readonly onContinue: () => void;
}

/**
 * One decision: which program. The card selects, a single button advances —
 * no pair of competing CTAs per card, and no commitment before the summary
 * has been read.
 */
export function StepProgram({
  entries,
  selectedId,
  onSelect,
  onContinue,
}: StepProgramProps): ReactNode {
  const { t } = useTranslation();
  const selected = entries.find((e) => e.id === selectedId) ?? null;

  return (
    <div data-testid="start-step-program">
      <h2 className="font-display mb-3 text-[40px] leading-[0.9] tracking-[0.03em] text-title sm:text-[52px]">
        {t('onboarding.program.title')}
      </h2>
      <p className="mb-7 max-w-[640px] text-[15px] leading-relaxed text-muted">
        {t('onboarding.program.subtitle')}
      </p>

      <div
        role="radiogroup"
        aria-label={t('onboarding.program.title')}
        className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {entries.map((entry) => {
          const isSelected = entry.id === selectedId;
          return (
            <button
              key={entry.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              data-testid="start-program-card"
              data-program-id={entry.id}
              onClick={() => onSelect(entry.id)}
              className={`flex flex-col gap-3 border bg-card p-5 text-left transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none ${
                isSelected ? 'border-accent' : 'border-rule hover:border-rule-light'
              }`}
            >
              <span className="flex items-center gap-3">
                <span className="font-display text-[28px] leading-none tracking-[0.03em] text-title">
                  {localizedProgramName(t, entry.id, entry.name)}
                </span>
                <span
                  className={`ml-auto font-mono text-2xs font-bold uppercase tracking-[0.08em] ${
                    isSelected ? 'text-accent' : 'text-info'
                  }`}
                >
                  {isSelected ? t('onboarding.program.selected') : t(LEVEL_LABEL_KEYS[entry.level])}
                </span>
              </span>
              <span className="text-[13px] leading-relaxed text-muted">
                {localizedProgramDescription(t, entry.id, entry.description)}
              </span>
              <span className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-rule pt-3 font-mono text-[11px] text-info">
                <span>{t('onboarding.program.sessions', { count: entry.totalWorkouts })}</span>
                <span>{t('onboarding.program.per_week', { count: entry.workoutsPerWeek })}</span>
                {entry.author !== '' && <span>{entry.author}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-5">
        <button
          type="button"
          data-testid="start-program-continue"
          onClick={onContinue}
          disabled={selected === null}
          style={{ boxShadow: 'var(--shadow-pressed-steel)' }}
          className="bg-accent px-7 py-3.5 font-mono text-xs font-bold uppercase tracking-[0.08em] text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        >
          {selected !== null
            ? t('onboarding.program.continue_with', {
                name: localizedProgramName(t, selected.id, selected.name),
              })
            : t('onboarding.program.continue')}
        </button>
        {selected !== null && (
          <Link
            to="/programs/$programId"
            params={{ programId: selected.id }}
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted underline-offset-4 hover:text-main hover:underline"
          >
            {t('onboarding.program.read_detail')}
          </Link>
        )}
        <span className="font-mono text-2xs text-info">{t('onboarding.program.one_path')}</span>
      </div>
    </div>
  );
}
