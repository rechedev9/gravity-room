import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { SlotOutcomeComparison } from '@gzclp/domain/progression-preview';
import { localizedExerciseName } from '@/lib/catalog-display';
import { formatDaysAgo } from '@/features/home/format-days-ago';
import type { PreviousSession } from './session-history';

export interface SessionSidePanelProps {
  readonly previous: PreviousSession | null;
  /** Whole days since the previous same-day session, when timestamps allow it. */
  readonly previousDaysAgo: number | null;
  /** What the current lift looks like next session if this set is failed. */
  readonly failPreview: SlotOutcomeComparison | null;
  readonly onGoToProfile?: () => void;
}

const SHORTCUT_KEYS = [
  { key: 'S', labelKey: 'tracker.session_panel.shortcut_success' },
  { key: 'F', labelKey: 'tracker.session_panel.shortcut_fail' },
  { key: 'U', labelKey: 'tracker.session_panel.shortcut_undo' },
  { key: '←→', labelKey: 'tracker.session_panel.shortcut_day' },
  { key: 'esc', labelKey: 'tracker.session_panel.shortcut_rest' },
] as const;

function PanelHeading({ children }: { readonly children: ReactNode }): ReactNode {
  return (
    <h3 className="mb-3 font-mono text-2xs font-bold uppercase tracking-[0.08em] text-info">
      {children}
    </h3>
  );
}

/**
 * Standing context rail for a session: what happened last time, what a failed
 * set costs, and the keyboard model as permanent chrome rather than a
 * discoverable overlay. Stats live in the profile — this only links there.
 */
export function SessionSidePanel({
  previous,
  previousDaysAgo,
  failPreview,
  onGoToProfile,
}: SessionSidePanelProps): ReactNode {
  const { t } = useTranslation();

  const failNote =
    failPreview !== null
      ? failPreview.stageChanged && failPreview.weightDelta === 0
        ? t('tracker.session_panel.fail_stage_same_weight', {
            stage: failPreview.next.stage + 1,
            scheme: `${failPreview.next.sets}×${failPreview.next.reps}`,
          })
        : failPreview.weightDelta < 0
          ? t('tracker.session_panel.fail_deload', { weight: failPreview.next.weight })
          : t('tracker.session_panel.fail_hold', { weight: failPreview.next.weight })
      : null;

  return (
    <aside
      data-testid="session-side-panel"
      aria-label={t('tracker.session_panel.aria')}
      className="flex flex-col gap-6 border-rule bg-header p-5 xl:border-l"
    >
      {previous !== null && (
        <div>
          <PanelHeading>
            {previousDaysAgo !== null
              ? t('tracker.session_panel.previous_with_age', {
                  age: formatDaysAgo(t, previousDaysAgo),
                })
              : t('tracker.session_panel.previous')}
          </PanelHeading>
          <ul>
            {previous.lines.map((line) => (
              <li
                key={line.slotId}
                className="flex items-baseline justify-between gap-3 border-b border-rule py-2 last:border-b-0"
              >
                <span className="min-w-0 truncate text-[12.5px] text-muted">
                  {localizedExerciseName(t, line.exerciseId, line.exerciseName)}
                </span>
                <span
                  className={`shrink-0 font-mono text-[12.5px] tabular-nums ${
                    line.result === 'fail' ? 'text-fail' : 'text-ok'
                  }`}
                >
                  {line.weight > 0 ? `${line.weight} · ` : ''}
                  {line.repsSummary}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {failNote !== null && (
        <div className="border border-rule bg-card px-4 py-3.5" data-testid="session-fail-preview">
          <PanelHeading>{t('tracker.session_panel.fail_title')}</PanelHeading>
          <p className="m-0 text-[12.5px] leading-relaxed text-muted">{failNote}</p>
        </div>
      )}

      <div className="hidden lg:block">
        <PanelHeading>{t('tracker.session_panel.keyboard')}</PanelHeading>
        <ul className="flex flex-col gap-2">
          {SHORTCUT_KEYS.map(({ key, labelKey }) => (
            <li key={key} className="font-mono text-[11px] text-muted">
              <kbd className="mr-2 border border-rule-light px-1.5 py-0.5 not-italic">{key}</kbd>
              {t(labelKey)}
            </li>
          ))}
        </ul>
      </div>

      {onGoToProfile && (
        <div className="mt-auto border-t border-rule pt-4">
          <button
            type="button"
            onClick={onGoToProfile}
            className="font-mono text-[11px] font-semibold uppercase tracking-[0.06em] text-muted transition-colors hover:text-main cursor-pointer"
          >
            {t('tracker.session_panel.stats_link')}
          </button>
        </div>
      )}
    </aside>
  );
}
