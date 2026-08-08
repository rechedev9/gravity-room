import type { GenericWorkoutRow } from '@gzclp/domain/types';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import type { ViewMode } from '@/lib/view-preference';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { localizedProgramDescription, localizedProgramName } from '@/lib/catalog-display';
import { GuestBanner } from '@/components/guest-banner';
import { ZoneHint } from '@/features/home/zone-hint';
import { DayNavigator } from '@/features/program-view/day-navigator';
import { CalendarNavigator } from '@/features/program-view/calendar-navigator';
import { ProgramAboutSection } from '@/features/program-view/program-about-section';
import { DayView, type SlotActions } from '@/features/program-view/day-view';
import { DetailedDayView } from '@/features/program-view/detailed-day-view';
import { DayStatusPill } from './day-status-pill';

interface ProgramTabContentProps {
  readonly definition: ProgramDefinition;
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
  readonly onPrevDay: () => void;
  readonly onNextDay: () => void;
  readonly onGoToCurrent: () => void;
  readonly onSelectDay: (index: number) => void;
  readonly onToggleView: () => void;
  readonly slotActions: SlotActions;
}

export function ProgramTabContent({
  definition,
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
  onPrevDay,
  onNextDay,
  onGoToCurrent,
  onSelectDay,
  onToggleView,
  slotActions,
}: ProgramTabContentProps): React.ReactNode {
  const { onMark, onUndo, onSetAmrapReps, onSetRpe, onSetTap, getSetLogs, isSlotLogging } =
    slotActions;
  const { t } = useTranslation();
  const name = localizedProgramName(t, definition.id, definition.name);
  const description = localizedProgramDescription(t, definition.id, definition.description);

  const completedDayIndices = useMemo<ReadonlySet<number>>(
    () =>
      new Set(rows.filter((r) => r.slots.every((s) => s.result !== undefined)).map((r) => r.index)),
    [rows]
  );

  const [navExpanded, setNavExpanded] = useState(false);

  const handleSelectDay = (idx: number): void => {
    onSelectDay(idx);
    setNavExpanded(false);
  };

  return (
    <div
      id="panel-program"
      role="tabpanel"
      aria-labelledby="tab-program"
      className="max-w-5xl mx-auto"
    >
      {isGuest && <GuestBanner className="mb-4 sm:mb-8" />}

      {/* 1. Slim day header with collapsible nav trigger */}
      <DayStatusPill
        dayIndex={selectedDayIndex}
        totalDays={totalWorkouts}
        dayName={selectedWorkout?.dayName ?? ''}
        isComplete={isDayComplete}
        isCurrent={selectedDayIndex === currentDayIndex}
        navExpanded={navExpanded}
        onToggleNav={() => setNavExpanded((x) => !x)}
      />

      {/* 2. Collapsible nav-block: DayNavigator + CalendarNavigator + view toggle */}
      {navExpanded && (
        <div
          data-testid="tracker-day-navigation-panel"
          className="mb-4 rounded-b-[var(--radius-base)] border border-t-0 border-rule bg-card p-3 shadow-[var(--shadow-card)] sm:p-4"
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

      {/* 3. Exercises — what the user came for */}
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
          <DayView
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
        ))}

      {/* 4. Secondary content moved below exercises.
          Hide the Sensei tip once the selected day is COMPLETE — post-session
          noise next to finished sets. */}
      <div className="max-w-2xl mx-auto mt-8 sm:mt-12 space-y-4">
        {!isDayComplete ? <ZoneHint zone="tracker" /> : null}
        <ProgramAboutSection
          title={`${t('tracker.tab_content.about_label')} ${name}`}
          description={description}
          authorLine={
            definition.author ? t('programs.card.author', { author: definition.author }) : undefined
          }
          totalWorkouts={totalWorkouts}
          workoutsPerWeek={workoutsPerWeek}
          dayCount={definition.days.length}
        />
      </div>
    </div>
  );
}
