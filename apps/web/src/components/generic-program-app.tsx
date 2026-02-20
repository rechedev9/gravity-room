import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ResultValue } from '@gzclp/shared/types';
import { useGenericProgram } from '@/hooks/use-generic-program';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { AppHeader } from './app-header';
import { ToastContainer } from './toast';
import { GenericSetupForm } from './generic-setup-form';
import { Toolbar } from './toolbar';
import { GenericWeekSection } from './generic-week-section';

// ---------------------------------------------------------------------------
// WeekNavigator (copied from gzclp-app, extracted for generic use)
// ---------------------------------------------------------------------------

interface WeekNavigatorProps {
  readonly selectedWeek: number;
  readonly totalWeeks: number;
  readonly currentWeekNumber: number;
  readonly weekDoneCount: number;
  readonly weekTotalCount: number;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onGoToCurrent: () => void;
}

function WeekNavigator({
  selectedWeek,
  totalWeeks,
  currentWeekNumber,
  weekDoneCount,
  weekTotalCount,
  onPrev,
  onNext,
  onGoToCurrent,
}: WeekNavigatorProps): ReactNode {
  return (
    <div className="flex items-center gap-3 mb-4">
      <button
        type="button"
        onClick={onPrev}
        disabled={selectedWeek <= 1}
        aria-label="Previous week"
        className="font-mono text-[11px] font-bold tracking-widest uppercase px-4 py-2.5 border-2 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors hover:bg-[var(--bg-hover-row)] hover:text-[var(--text-main)]"
      >
        &larr; Prev
      </button>

      <div className="flex-1 flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <span className="font-display" style={{ fontSize: '20px', letterSpacing: '0.05em' }}>
            Week {selectedWeek}
          </span>
          <span
            className="font-mono text-[var(--text-muted)] tabular-nums"
            style={{ fontSize: '10px', letterSpacing: '0.1em' }}
          >
            / {totalWeeks}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`font-mono ${weekDoneCount === weekTotalCount ? 'text-[var(--fill-progress)]' : 'text-[var(--text-muted)]'}`}
            style={{ fontSize: '11px', letterSpacing: '0.25em' }}
            aria-label={`${weekDoneCount} of ${weekTotalCount} workouts done`}
          >
            {'●'.repeat(weekDoneCount)}
            {'○'.repeat(weekTotalCount - weekDoneCount)}
          </span>
          {selectedWeek !== currentWeekNumber && (
            <button
              type="button"
              onClick={onGoToCurrent}
              className="font-mono text-[10px] font-bold tracking-widest uppercase text-[var(--fill-progress)] hover:underline cursor-pointer bg-transparent border-none p-0"
            >
              &rarr; Current
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={selectedWeek >= totalWeeks}
        aria-label="Next week"
        className="font-mono text-[11px] font-bold tracking-widest uppercase px-4 py-2.5 border-2 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors hover:bg-[var(--bg-hover-row)] hover:text-[var(--text-main)]"
      >
        Next &rarr;
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GenericProgramApp
// ---------------------------------------------------------------------------

interface GenericProgramAppProps {
  readonly programId: string;
  readonly instanceId?: string;
  readonly onBackToDashboard?: () => void;
  readonly onGoToProfile?: () => void;
}

export function GenericProgramApp({
  programId,
  instanceId,
  onBackToDashboard,
  onGoToProfile,
}: GenericProgramAppProps): React.ReactNode {
  const {
    definition,
    config,
    rows,
    undoHistory,
    generateProgram,
    updateConfig,
    markResult,
    setAmrapReps,
    undoSpecific,
    undoLast,
    resetAll,
  } = useGenericProgram(programId, instanceId);

  const { signOut } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const workoutsPerWeek = definition?.workoutsPerWeek ?? 4;
  const totalWorkouts = definition?.totalWorkouts ?? 0;

  const completedCount = useMemo(
    () => rows.filter((r) => r.slots.every((s) => s.result !== undefined)).length,
    [rows]
  );

  const firstPendingIdx = useMemo(() => {
    const pending = rows.find((r) => r.slots.some((s) => s.result === undefined));
    return pending ? pending.index : -1;
  }, [rows]);

  const weeks = useMemo(
    () =>
      Array.from({ length: Math.ceil(rows.length / workoutsPerWeek) }, (_, i) => ({
        week: i + 1,
        rows: rows.slice(i * workoutsPerWeek, (i + 1) * workoutsPerWeek),
      })),
    [rows, workoutsPerWeek]
  );

  const currentWeekNumber = useMemo(
    () =>
      firstPendingIdx >= 0
        ? Math.floor(firstPendingIdx / workoutsPerWeek) + 1
        : Math.max(weeks.length, 1),
    [firstPendingIdx, workoutsPerWeek, weeks.length]
  );

  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  const currentWeekNumberRef = useRef(currentWeekNumber);
  currentWeekNumberRef.current = currentWeekNumber;

  useEffect(() => {
    if (currentWeekNumberRef.current > 0) {
      setSelectedWeek(currentWeekNumberRef.current);
    }
  }, [config]);

  const weekDoneCount = useMemo(
    () =>
      (weeks[selectedWeek - 1]?.rows ?? []).filter((r) =>
        r.slots.every((s) => s.result !== undefined)
      ).length,
    [weeks, selectedWeek]
  );
  const weekTotalCount = weeks[selectedWeek - 1]?.rows.length ?? workoutsPerWeek;

  const handleMarkResult = useCallback(
    (workoutIndex: number, slotId: string, value: ResultValue): void => {
      markResult(workoutIndex, slotId, value);
      const row = rows[workoutIndex];
      if (!row) return;
      const slot = row.slots.find((s) => s.slotId === slotId);
      if (!slot) return;
      const resultLabel = value === 'success' ? 'Success' : 'Fail';
      toast({
        message: `#${workoutIndex + 1}: ${slot.exerciseName} ${slot.tier.toUpperCase()} — ${resultLabel}`,
        action: {
          label: 'Undo',
          onClick: () => undoSpecific(workoutIndex, slotId),
        },
      });
    },
    [markResult, rows, toast, undoSpecific]
  );

  const jumpToCurrent = useCallback(() => {
    setSelectedWeek(currentWeekNumber);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.querySelector('[data-current-row]');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('highlight-current');
          const handleEnd = (): void => {
            el.classList.remove('highlight-current');
            el.removeEventListener('animationend', handleEnd);
          };
          el.addEventListener('animationend', handleEnd);
        }
      });
    });
  }, [currentWeekNumber]);

  useEffect(() => {
    if (!config) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') setSelectedWeek((w) => Math.max(1, w - 1));
      else if (e.key === 'ArrowRight') setSelectedWeek((w) => Math.min(weeks.length, w + 1));
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [config, weeks.length]);

  const handleSignOut = useCallback(async (): Promise<void> => {
    await signOut();
    queryClient.clear();
  }, [signOut, queryClient]);

  if (!definition) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-[var(--text-muted)]">
        Unknown program: {programId}
      </div>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-50">
        <AppHeader
          backLabel="Programs"
          onBack={onBackToDashboard}
          onGoToProfile={onGoToProfile}
          onSignOut={() => void handleSignOut()}
        />

        {config && (
          <Toolbar
            completedCount={completedCount}
            totalWorkouts={totalWorkouts}
            undoCount={undoHistory.length}
            onUndo={undoLast}
            onJumpToCurrent={jumpToCurrent}
            onReset={resetAll}
          />
        )}
      </div>

      <div className="max-w-[1300px] mx-auto px-5 pb-20">
        <GenericSetupForm
          definition={definition}
          initialConfig={config}
          onGenerate={generateProgram}
          onUpdateConfig={updateConfig}
        />

        {config && rows.length > 0 && (
          <>
            {/* Program info */}
            <details className="bg-[var(--bg-card)] border border-[var(--border-color)] mb-6 overflow-hidden">
              <summary className="font-mono px-5 py-3.5 font-bold cursor-pointer select-none flex justify-between items-center [&::marker]:hidden list-none text-[11px] tracking-widest uppercase">
                About {definition.name}
                <span className="transition-transform duration-200 [[open]>&]:rotate-90">
                  &#9656;
                </span>
              </summary>
              <div className="px-5 pb-5 border-t border-[var(--border-light)]">
                <p className="mt-3 text-[13px] leading-7 text-[var(--text-info)]">
                  {definition.description}
                </p>
                {definition.author && (
                  <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                    By {definition.author}
                  </p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-[var(--text-muted)]">
                  <span>{totalWorkouts} total workouts</span>
                  <span>{workoutsPerWeek} per week</span>
                  <span>{definition.days.length}-day rotation</span>
                </div>
              </div>
            </details>

            <WeekNavigator
              selectedWeek={selectedWeek}
              totalWeeks={weeks.length}
              currentWeekNumber={currentWeekNumber}
              weekDoneCount={weekDoneCount}
              weekTotalCount={weekTotalCount}
              onPrev={() => setSelectedWeek((w) => Math.max(1, w - 1))}
              onNext={() => setSelectedWeek((w) => Math.min(weeks.length, w + 1))}
              onGoToCurrent={jumpToCurrent}
            />
            {weeks[selectedWeek - 1] && (
              <GenericWeekSection
                key={selectedWeek}
                week={selectedWeek}
                rows={weeks[selectedWeek - 1].rows}
                firstPendingIdx={firstPendingIdx}
                forceExpanded
                onMark={handleMarkResult}
                onSetAmrapReps={setAmrapReps}
                onUndo={undoSpecific}
              />
            )}
          </>
        )}
      </div>

      <ToastContainer />
    </>
  );
}
