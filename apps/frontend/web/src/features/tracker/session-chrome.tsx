import { useTranslation } from 'react-i18next';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import { progressFillPercent } from '@/components/progress-bar';
import { localizedConfigFieldLabel } from '@/lib/catalog-display';
import { buildWeightsSummary } from './weights-summary';
import { SessionMenu, type SessionMenuProps } from './session-menu';

export interface SessionChromeProps extends SessionMenuProps {
  readonly definition: ProgramDefinition;
  readonly config: Record<string, number | string>;
  readonly dayIndex: number;
  readonly totalDays: number;
  readonly dayName: string;
  readonly isCurrentDay: boolean;
  /** Slots resolved in the selected day, and how many there are in total. */
  readonly doneSlots: number;
  readonly totalSlots: number;
  /** Whole-program progress — drives the proactive finish CTA. */
  readonly completedDays: number;
  readonly navExpanded: boolean;
  readonly onToggleNav: () => void;
  readonly onEditWeights: () => void;
}

/**
 * The single band of chrome above a session. It replaces the former stack of
 * toolbar + weights pill + day pill + tabs: day identity, day progress, the
 * starting weights and the overflow menu now share one 48px-tall row.
 *
 * Undo deliberately does not live here — it belongs on the card where the
 * mistake happened, plus the `U` shortcut and the post-result toast.
 */
export function SessionChrome({
  definition,
  config,
  dayIndex,
  totalDays,
  dayName,
  isCurrentDay,
  doneSlots,
  totalSlots,
  completedDays,
  navExpanded,
  onToggleNav,
  onEditWeights,
  ...menuProps
}: SessionChromeProps): React.ReactNode {
  const { t } = useTranslation();
  const localize = (key: string, fallback: string): string =>
    localizedConfigFieldLabel(t, key, fallback);
  const overflow = (n: number): string => t('tracker.setup_form.overflow_indicator', { n });
  const summary = buildWeightsSummary(config, definition.configFields, overflow, localize);
  const mobileSummary = buildWeightsSummary(config, definition.configFields, overflow, localize, 1);
  const percent = progressFillPercent(doneSlots, totalSlots);
  const programComplete = completedDays >= totalDays && totalDays > 0;

  return (
    <div
      data-testid="session-chrome"
      className="flex min-h-[48px] flex-wrap items-center gap-x-4 gap-y-2 border-b border-rule bg-card px-3 py-2 shadow-toolbar sm:px-6"
    >
      {/* Day identity */}
      <div className="flex shrink-0 items-baseline gap-2.5">
        <span className="font-display text-2xl leading-none tracking-[0.04em] text-title">
          {t('tracker.day_status.day_label')} {dayIndex + 1}
        </span>
        <span className="font-mono text-[11px] text-info">/ {totalDays}</span>
      </div>

      <span className="hidden h-4 w-px bg-rule sm:block" aria-hidden="true" />

      <span className="min-w-0 truncate text-[13px] font-semibold text-title">
        {dayName || '—'}
      </span>

      <button
        type="button"
        onClick={onToggleNav}
        aria-expanded={navExpanded}
        data-testid="session-chrome-change-day"
        className="shrink-0 border border-rule px-2.5 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-info transition-colors hover:border-rule-light hover:text-main cursor-pointer"
      >
        {navExpanded ? t('tracker.day_status.close') : t('tracker.day_status.change_day')}
      </button>

      {/* Day progress */}
      <div
        className="flex max-w-[220px] flex-1 items-center gap-2.5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totalSlots}
        aria-valuenow={doneSlots}
        aria-label={t('tracker.session_chrome.day_progress_aria')}
      >
        <div className="h-[3px] flex-1 bg-progress-track">
          <div data-fill className="h-[3px] bg-accent" style={{ width: `${percent}%` }} />
        </div>
        <span className="font-mono text-[11px] tabular-nums text-muted">
          {doneSlots}/{totalSlots}
        </span>
      </div>

      {/* Starting weights + edit */}
      <p
        data-testid="session-chrome-weights"
        className="ml-auto min-w-0 truncate font-mono text-[11px] text-info"
        title={summary}
      >
        <span className="sm:hidden">{mobileSummary || '—'}</span>
        <span className="hidden sm:inline">{summary || '—'}</span>
      </p>
      <button
        type="button"
        onClick={onEditWeights}
        data-testid="session-chrome-edit-weights"
        aria-label={t('tracker.session_chrome.edit_weights_aria')}
        className="shrink-0 border border-rule px-2.5 py-1.5 font-mono text-[10px] font-bold text-info transition-colors hover:border-rule-light hover:text-main cursor-pointer"
      >
        &#9998;
      </button>

      <span className="hidden h-4 w-px bg-rule sm:block" aria-hidden="true" />
      <SessionMenu {...menuProps} showFinishCta={programComplete} />

      {isCurrentDay && <span className="sr-only">{t('tracker.day_status.today_prefix')}</span>}
    </div>
  );
}
