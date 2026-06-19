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
      className="max-w-2xl mx-auto"
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
        <div className="mb-4">
          <DayNavigator
            selectedDayIndex={selectedDayIndex}
            totalDays={totalWorkouts}
            currentDayIndex={currentDayIndex}
            dayName={selectedWorkout?.dayName ?? ''}
            isDayComplete={isDayComplete}
            showKeyboardHints
            onPrev={onPrevDay}
            onNext={onNextDay}
            onGoToCurrent={onGoToCurrent}
          />
          {rows.length > 0 && (
            <div className="mt-3">
              <CalendarNavigator
                rows={rows}
                selectedDayIndex={selectedDayIndex}
                currentDayIndex={currentDayIndex}
                workoutsPerWeek={workoutsPerWeek}
                resultTimestamps={resultTimestamps}
                completedDayIndices={completedDayIndices}
                context="tracker"
                onSelectDay={handleSelectDay}
              />
            </div>
          )}
          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={onToggleView}
              aria-label={
                viewMode === 'detailed'
                  ? t('tracker.tab_content.aria_compact_view')
                  : t('tracker.tab_content.aria_detailed_view')
              }
              className="text-2xs font-bold text-muted hover:text-main tracking-wide uppercase cursor-pointer transition-colors min-h-[44px] px-2 inline-flex items-center"
            >
              {viewMode === 'detailed'
                ? t('tracker.tab_content.compact_view')
                : t('tracker.tab_content.detailed_view')}
            </button>
          </div>
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

      {/* 4. Secondary content moved below exercises */}
      <div className="mt-8 sm:mt-12 space-y-4">
        <ZoneHint zone="tracker" />
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
