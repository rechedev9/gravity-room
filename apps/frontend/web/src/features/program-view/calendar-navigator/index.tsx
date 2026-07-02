import { useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { loadNavMode, saveNavMode } from '../program-navigation-preference';
import type { NavMode } from '../program-navigation-preference';
import { trackEvent } from '@/lib/analytics';
import { DayView } from './day-view';
import { WeekView } from './week-view';
import { MonthView } from './month-view';
import { HistoryView } from './history-view';
import { JumpForm } from './jump-form';
import { NavModeSelector, ReadingSelector } from './selectors';
import type { ReadingMode } from './selectors';
import type { CalendarNavigatorProps } from './shared';

// ---------------------------------------------------------------------------
// CalendarNavigator
// ---------------------------------------------------------------------------

export function CalendarNavigator({
  rows,
  selectedDayIndex,
  currentDayIndex,
  workoutsPerWeek,
  resultTimestamps,
  completedDayIndices,
  context,
  onSelectDay,
}: CalendarNavigatorProps): ReactNode {
  const { t } = useTranslation();

  // Nav mode — persisted independently from compact/detailed ViewMode
  const [navMode, setNavMode] = useState<NavMode>(() => loadNavMode());

  // Reading mode — only relevant in tracker context
  const [readingMode, setReadingMode] = useState<ReadingMode>('program');

  function handleNavModeChange(mode: NavMode): void {
    setNavMode(mode);
    saveNavMode(mode);
    trackEvent('program_navigation_mode_change', { mode, context });
  }

  // In preview: always show program-relative calendar, no reading selector
  // In tracker: show reading selector (Programa | Historial real)
  const showReadingSelector = context === 'tracker';
  const showHistory = context === 'tracker' && readingMode === 'history';

  return (
    // data-context is used by integration tests and future CSS theming (preview vs tracker)
    <div className="flex flex-col gap-4" data-context={context}>
      {/* ── Preview badge: clarify this is program-relative ── */}
      {context === 'preview' && (
        <p
          className="text-2xs text-muted uppercase tracking-wide font-semibold"
          data-testid="preview-program-weeks-label"
        >
          {t('calendar_navigator.preview_program_weeks_label')}
        </p>
      )}

      {/* ── Tracker: reading selector ── */}
      {showReadingSelector && <ReadingSelector mode={readingMode} onChange={setReadingMode} />}

      {/* ── History view (tracker only) ── */}
      {showHistory ? (
        <HistoryView
          rows={rows}
          resultTimestamps={resultTimestamps}
          completedDayIndices={completedDayIndices}
          selectedDayIndex={selectedDayIndex}
          onSelectDay={onSelectDay}
        />
      ) : (
        <>
          {/* ── Mode selector (program view) ── */}
          <NavModeSelector mode={navMode} onChange={handleNavModeChange} />

          {/* ── Mode-specific content ── */}
          {navMode === 'day' && (
            <DayView
              rows={rows}
              selectedDayIndex={selectedDayIndex}
              currentDayIndex={currentDayIndex}
              resultTimestamps={resultTimestamps}
              completedDayIndices={completedDayIndices}
              context={context}
              onSelectDay={onSelectDay}
            />
          )}

          {navMode === 'week' && (
            <WeekView
              rows={rows}
              selectedDayIndex={selectedDayIndex}
              currentDayIndex={currentDayIndex}
              workoutsPerWeek={workoutsPerWeek}
              resultTimestamps={resultTimestamps}
              completedDayIndices={completedDayIndices}
              onSelectDay={onSelectDay}
            />
          )}

          {navMode === 'month' && (
            <MonthView
              rows={rows}
              selectedDayIndex={selectedDayIndex}
              currentDayIndex={currentDayIndex}
              workoutsPerWeek={workoutsPerWeek}
              resultTimestamps={resultTimestamps}
              completedDayIndices={completedDayIndices}
              onSelectDay={onSelectDay}
            />
          )}

          {/* ── Jump to workout (always visible in week/month modes) ── */}
          {navMode !== 'day' && (
            <JumpForm rows={rows} context={context} onSelectDay={onSelectDay} />
          )}
        </>
      )}
    </div>
  );
}
