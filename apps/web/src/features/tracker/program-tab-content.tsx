import type { ResultValue, GenericWorkoutRow, SetLogEntry } from '@gzclp/shared/types';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import type { ViewMode } from '@/lib/view-preference';
import { useTranslation } from 'react-i18next';
import { GuestBanner } from '@/components/guest-banner';
import { DayNavigator } from '@/features/program-view/day-navigator';
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
  return (
    <div
      id="panel-program"
      role="tabpanel"
      aria-labelledby="tab-program"
      className="max-w-2xl mx-auto"
    >
      {isGuest && <GuestBanner className="mb-4 sm:mb-8" />}

      <details className="group bg-card border border-rule mb-4 sm:mb-8 overflow-hidden">
        <summary className="px-5 py-3.5 font-bold cursor-pointer select-none flex justify-between items-center [&::marker]:hidden list-none text-xs tracking-wide">
          {t('tracker.tab_content.about_label')} {definition.name}
          <span className="transition-transform duration-200 group-open:rotate-90">&#9656;</span>
        </summary>
        <div className="px-5 pb-5 border-t border-rule-light">
          <p className="mt-3 text-sm leading-7 text-info">{definition.description}</p>
          {definition.author && (
            <p className="mt-2 text-xs text-muted">
              {t('programs.card.author', { author: definition.author })}
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted">
            <span>
              {totalWorkouts} {t('tracker.tab_content.total_workouts')}
            </span>
            <span>
              {workoutsPerWeek} {t('tracker.tab_content.per_week')}
            </span>
            <span>
              {t('tracker.tab_content.rotation_of')} {definition.days.length}{' '}
              {t('tracker.tab_content.days')}
            </span>
          </div>
        </div>
      </details>

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
