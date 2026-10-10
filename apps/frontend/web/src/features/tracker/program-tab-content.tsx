import type { GenericWorkoutRow } from '@gzclp/domain/types';
import type { GenericResults, ProgramDefinition } from '@gzclp/domain/types/program';
import type { ViewMode } from '@/lib/view-preference';
import { useTranslation } from 'react-i18next';
import { GuestBanner } from '@/components/guest-banner';
import { CalendarNavigator } from '@/features/program-view/calendar-navigator';
import { DetailedDayView } from '@/features/program-view/detailed-day-view';
import type { SlotActions } from '@/features/program-view/day-view';
import { DayCompletedPanel } from './day-completed-panel';
import { SessionView } from './session-view';
import { isLatestFinishedDay } from './session-history';

interface ProgramTabContentProps {
  readonly definition: ProgramDefinition;
  readonly config: Record<string, number | string>;
  readonly results: GenericResults;
  readonly isGuest: boolean;
  readonly rows: readonly GenericWorkoutRow[];
  readonly selectedWorkout: GenericWorkoutRow | undefined;
  readonly selectedDayIndex: number;
  readonly currentDayIndex: number;
  readonly completedDayIndices: ReadonlySet<number>;
  readonly viewMode: ViewMode;
  readonly workoutsPerWeek: number;
  readonly resultTimestamps?: Readonly<Record<string, string>>;
  /** Day-picker panel, toggled from the session chrome. */
  readonly navExpanded: boolean;
  readonly onCloseNav: () => void;
  readonly onNextDay: () => void;
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
  completedDayIndices,
  viewMode,
  workoutsPerWeek,
  resultTimestamps,
  navExpanded,
  onCloseNav,
  onNextDay,
  onSelectDay,
  onToggleView,
  onGoToProfile,
  slotActions,
}: ProgramTabContentProps): React.ReactNode {
  const { onMark, onUndo, onSetAmrapReps, onSetRpe, onSetTap, getSetLogs, isSlotLogging } =
    slotActions;
  const { t } = useTranslation();

  const handleSelectDay = (idx: number): void => {
    onSelectDay(idx);
    onCloseNav();
  };

  const showCompletion =
    selectedWorkout !== undefined && isLatestFinishedDay(rows, selectedWorkout, currentDayIndex);

  return (
    <div id="panel-program">
      {isGuest && <GuestBanner className="mb-4" />}

      {/* Day picker — collapsed by default, opened from the chrome band. */}
      {navExpanded && (
        <div
          data-testid="tracker-day-navigation-panel"
          className="mb-4 rounded-card border border-rule bg-card p-3 sm:p-4"
        >
          {rows.length > 0 && (
            <div>
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
                    className="type-button min-h-[44px] border border-rule bg-card rounded-control px-3 text-muted transition-colors hover:border-rule-light hover:text-main cursor-pointer"
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
          <>
            {showCompletion && (
              <DayCompletedPanel
                rows={rows}
                workout={selectedWorkout}
                totalDays={definition.totalWorkouts}
                nextWorkout={rows[selectedWorkout.index + 1] ?? null}
                onGoToNextDay={onNextDay}
              />
            )}
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
          </>
        ) : (
          <SessionView
            definition={definition}
            config={config}
            results={results}
            rows={rows}
            workout={selectedWorkout}
            isCurrent={selectedDayIndex === currentDayIndex}
            showCompletion={showCompletion}
            resultTimestamps={resultTimestamps}
            onGoToNextDay={onNextDay}
            onGoToProfile={onGoToProfile}
            slotActions={slotActions}
          />
        ))}
    </div>
  );
}
