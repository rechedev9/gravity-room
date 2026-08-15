import type { GenericWorkoutRow } from '@gzclp/domain/types';
import type { GenericResults, ProgramDefinition } from '@gzclp/domain/types/program';
import type { ViewMode } from '@/lib/view-preference';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GuestBanner } from '@/components/guest-banner';
import { DayNavigator } from '@/features/program-view/day-navigator';
import { CalendarNavigator } from '@/features/program-view/calendar-navigator';
import { DetailedDayView } from '@/features/program-view/detailed-day-view';
import type { SlotActions } from '@/features/program-view/day-view';
import { SessionView } from './session-view';

interface ProgramTabContentProps {
  readonly definition: ProgramDefinition;
  readonly config: Record<string, number | string>;
  readonly results: GenericResults;
  readonly isGuest: boolean;
  readonly rows: readonly GenericWorkoutRow[];
  readonly selectedWorkout: GenericWorkoutRow | undefined;
  readonly selectedDayIndex: number;
  readonly currentDayIndex: number;
  readonly totalWorkouts: number;
  readonly isDayComplete: boolean;
  readonly viewMode: ViewMode;
  readonly workoutsPerWeek: number;
  readonly resultTimestamps?: Readonly<Record<string, string>>;
  /** Day-picker panel, toggled from the session chrome. */
  readonly navExpanded: boolean;
  readonly rest: { readonly seconds: number; readonly id: number } | null;
  readonly onSkipRest: () => void;
  readonly onCloseNav: () => void;
  readonly onPrevDay: () => void;
  readonly onNextDay: () => void;
  readonly onGoToCurrent: () => void;
  readonly onSelectDay: (index: number) => void;
  readonly onToggleView: () => void;
  readonly onGoToProfile?: () => void;
  readonly slotActions: SlotActions;
}

export function ProgramTabContent({
  definition,
  config,
  results,
  isGuest,
  rows,
  selectedWorkout,
  selectedDayIndex,
  currentDayIndex,
  totalWorkouts,
  isDayComplete,
  viewMode,
  workoutsPerWeek,
  resultTimestamps,
  navExpanded,
  rest,
  onSkipRest,
  onCloseNav,
  onPrevDay,
  onNextDay,
  onGoToCurrent,
  onSelectDay,
  onToggleView,
  onGoToProfile,
  slotActions,
}: ProgramTabContentProps): React.ReactNode {
  const { onMark, onUndo, onSetAmrapReps, onSetRpe, onSetTap, getSetLogs, isSlotLogging } =
    slotActions;
  const { t } = useTranslation();

  const completedDayIndices = useMemo<ReadonlySet<number>>(
    () =>
      new Set(rows.filter((r) => r.slots.every((s) => s.result !== undefined)).map((r) => r.index)),
    [rows]
  );

  const handleSelectDay = (idx: number): void => {
    onSelectDay(idx);
    onCloseNav();
  };

  return (
    <div id="panel-program">
      {isGuest && <GuestBanner className="mb-4" />}

      {/* Day picker — collapsed by default, opened from the chrome band. */}
      {navExpanded && (
        <div
          data-testid="tracker-day-navigation-panel"
          className="mb-4 border border-rule bg-card p-3 shadow-[var(--shadow-card)] sm:p-4"
        >
          <DayNavigator
            selectedDayIndex={selectedDayIndex}
            totalDays={totalWorkouts}
            currentDayIndex={currentDayIndex}
            dayName={selectedWorkout?.dayName ?? ''}
            isDayComplete={isDayComplete}
            compact
            onPrev={onPrevDay}
            onNext={onNextDay}
            onGoToCurrent={onGoToCurrent}
          />
          {rows.length > 0 && (
            <div className="mt-3 border-t border-rule pt-3">
              <CalendarNavigator
                rows={rows}
                selectedDayIndex={selectedDayIndex}
                currentDayIndex={currentDayIndex}
                workoutsPerWeek={workoutsPerWeek}
                resultTimestamps={resultTimestamps}
                completedDayIndices={completedDayIndices}
                context="tracker"
                onSelectDay={handleSelectDay}
                toolbarEnd={
                  <button
                    type="button"
                    onClick={onToggleView}
                    aria-label={
                      viewMode === 'detailed'
                        ? t('tracker.tab_content.aria_compact_view')
                        : t('tracker.tab_content.aria_detailed_view')
                    }
                    className="min-h-[44px] border border-rule bg-card px-3 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-muted transition-colors hover:border-rule-light hover:text-main cursor-pointer"
                  >
                    {viewMode === 'detailed'
                      ? t('tracker.tab_content.compact_view')
                      : t('tracker.tab_content.detailed_view')}
                  </button>
                }
              />
            </div>
          )}
        </div>
      )}

      {selectedWorkout &&
        (viewMode === 'detailed' ? (
          <DetailedDayView
            workout={selectedWorkout}
            isCurrent={selectedDayIndex === currentDayIndex}
            onMark={onMark}
            onUndo={onUndo}
            onSetAmrapReps={onSetAmrapReps}
            onSetRpe={onSetRpe}
            onSetTap={onSetTap}
            getSetLogs={getSetLogs}
            isSlotLogging={isSlotLogging}
          />
        ) : (
          <SessionView
            definition={definition}
            config={config}
            results={results}
            rows={rows}
            workout={selectedWorkout}
            isCurrent={selectedDayIndex === currentDayIndex}
            resultTimestamps={resultTimestamps}
            rest={rest}
            onSkipRest={onSkipRest}
            onGoToProfile={onGoToProfile}
            slotActions={slotActions}
          />
        ))}
    </div>
  );
}
