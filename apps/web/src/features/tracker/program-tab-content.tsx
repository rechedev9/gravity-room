import type { ResultValue, GenericWorkoutRow, SetLogEntry } from '@gzclp/shared/types';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import type { ViewMode } from '@/lib/view-preference';
import { useTranslation } from 'react-i18next';
import { localizedProgramDescription, localizedProgramName } from '@/lib/catalog-display';
import { GuestBanner } from '@/components/guest-banner';
import { DayNavigator } from '@/features/program-view/day-navigator';
import { ProgramAboutSection } from '@/features/program-view/program-about-section';
import { DayView } from '@/features/program-view/day-view';
import { DetailedDayView } from '@/features/program-view/detailed-day-view';

interface ProgramTabContentProps {
  readonly definition: ProgramDefinition;
  readonly isGuest: boolean;
  readonly selectedWorkout: GenericWorkoutRow | undefined;
  readonly selectedDayIndex: number;
  readonly currentDayIndex: number;
  readonly totalWorkouts: number;
  readonly isDayComplete: boolean;
  readonly viewMode: ViewMode;
  readonly workoutsPerWeek: number;
  readonly onPrevDay: () => void;
  readonly onNextDay: () => void;
  readonly onGoToCurrent: () => void;
  readonly onToggleView: () => void;
  readonly onMark: (workoutIndex: number, slotId: string, value: ResultValue) => void;
  readonly onUndo: (workoutIndex: number, slotId: string) => void;
  readonly onSetAmrapReps: (workoutIndex: number, slotId: string, reps: number | undefined) => void;
  readonly onSetRpe: (workoutIndex: number, slotId: string, rpe: number | undefined) => void;
  readonly onSetTap: (
    workoutIndex: number,
    slotId: string,
    setIndex: number,
    reps: number,
    weight?: number,
    rpe?: number
  ) => void;
  readonly getSetLogs: (workoutIndex: number, slotId: string) => readonly SetLogEntry[] | undefined;
  readonly isSlotLogging: (workoutIndex: number, slotId: string) => boolean;
}

export function ProgramTabContent({
  definition,
  isGuest,
  selectedWorkout,
  selectedDayIndex,
  currentDayIndex,
  totalWorkouts,
  isDayComplete,
  viewMode,
  workoutsPerWeek,
  onPrevDay,
  onNextDay,
  onGoToCurrent,
  onToggleView,
  onMark,
  onUndo,
  onSetAmrapReps,
  onSetRpe,
  onSetTap,
  getSetLogs,
  isSlotLogging,
}: ProgramTabContentProps): React.ReactNode {
  const { t } = useTranslation();
  const name = localizedProgramName(t, definition.id, definition.name);
  const description = localizedProgramDescription(t, definition.id, definition.description);
  return (
    <div
      id="panel-program"
      role="tabpanel"
      aria-labelledby="tab-program"
      className="max-w-2xl mx-auto"
    >
      {isGuest && <GuestBanner className="mb-4 sm:mb-8" />}

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

      <DayNavigator
        selectedDayIndex={selectedDayIndex}
        totalDays={totalWorkouts}
        currentDayIndex={currentDayIndex}
        dayName={selectedWorkout?.dayName ?? ''}
        isDayComplete={isDayComplete}
        onPrev={onPrevDay}
        onNext={onNextDay}
        onGoToCurrent={onGoToCurrent}
      />

      <div className="flex justify-end mb-2">
        <button
          type="button"
          onClick={onToggleView}
          aria-label={
            viewMode === 'detailed'
              ? t('tracker.tab_content.aria_compact_view')
              : t('tracker.tab_content.aria_detailed_view')
          }
          className="text-2xs font-bold text-muted hover:text-main tracking-wide uppercase cursor-pointer transition-colors"
        >
          {viewMode === 'detailed'
            ? t('tracker.tab_content.compact_view')
            : t('tracker.tab_content.detailed_view')}
        </button>
      </div>

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
    </div>
  );
}
