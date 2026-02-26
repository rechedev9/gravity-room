import { lazy, Suspense, useState, useTransition, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { ResultValue, GenericWorkoutRow } from '@gzclp/shared/types';
import { useGenericProgram } from '@/hooks/use-generic-program';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { detectGenericPersonalRecord } from '@/lib/pr-detection';
import { useWebMcp } from '@/hooks/use-webmcp';
import { AppHeader } from './app-header';
import { ConfirmDialog } from './confirm-dialog';
import { DayNavigator } from './day-navigator';
import type { DayTab } from './day-navigator';
import { DayView } from './day-view';
import type { DayViewSlot } from './day-view';
import { ErrorBoundary } from './error-boundary';
import { GenericSetupForm } from './generic-setup-form';
import { StatsSkeleton } from './stats-skeleton';
import { TabButton } from './tab-button';
import { ToastContainer } from './toast';
import { Toolbar } from './toolbar';
import { WeekNavigator } from './week-navigator';

const GenericStatsPanel = lazy(() => import('./generic-stats-panel'));
const preloadGenericStatsPanel = (): void => {
  void import('./generic-stats-panel');
};

function genericRowToSlots(row: GenericWorkoutRow): readonly DayViewSlot[] {
  return row.slots.map((slot) => ({
    key: slot.slotId,
    exerciseName: slot.exerciseName,
    tierLabel: slot.tier.toUpperCase(),
    role: slot.role ?? 'accessory',
    weight: slot.weight,
    scheme: `${slot.sets}\u00d7${slot.reps}${slot.repsMax !== undefined ? `-${slot.repsMax}` : ''}`,
    stage: slot.stage,
    showStage: slot.stage > 0,
    isAmrap: slot.isAmrap,
    result: slot.result,
    amrapReps: slot.amrapReps,
    rpe: slot.rpe,
    showRpe: slot.role === 'primary',
    isChanged: slot.isChanged,
  }));
}

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
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user === null) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, navigate]);

  const {
    definition,
    config,
    rows,
    undoHistory,
    isGenerating,
    generateProgram,
    updateConfig,
    markResult,
    setAmrapReps,
    setRpe,
    undoSpecific,
    undoLast,
    finishProgram,
    resetAll,
  } = useGenericProgram(programId, instanceId);

  useWebMcp({
    config,
    rows,
    definition,
    totalWorkouts: definition?.totalWorkouts ?? 0,
    generateProgram,
    markResult,
    setAmrapReps,
    undoLast,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'program' | 'stats'>('program');
  const [isPending, startTransition] = useTransition();
  const [rpeReminder, setRpeReminder] = useState<{
    workoutIndex: number;
    slotId: string;
    value: ResultValue;
    rpeTarget: string;
  } | null>(null);

  const workoutsPerWeek = definition?.workoutsPerWeek ?? 4;
  const totalWorkouts = definition?.totalWorkouts ?? 0;

  const completedCount = rows.filter((r) => r.slots.every((s) => s.result !== undefined)).length;

  const firstPendingIdx = (() => {
    const pending = rows.find((r) => r.slots.some((s) => s.result === undefined));
    return pending ? pending.index : -1;
  })();

  const weeks = Array.from({ length: Math.ceil(rows.length / workoutsPerWeek) }, (_, i) => ({
    week: i + 1,
    rows: rows.slice(i * workoutsPerWeek, (i + 1) * workoutsPerWeek),
  }));

  const currentWeekNumber =
    firstPendingIdx >= 0
      ? Math.floor(firstPendingIdx / workoutsPerWeek) + 1
      : Math.max(weeks.length, 1);

  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  const currentWeekNumberRef = useRef(currentWeekNumber);
  currentWeekNumberRef.current = currentWeekNumber;

  useEffect(() => {
    if (currentWeekNumberRef.current > 0) {
      setSelectedWeek(currentWeekNumberRef.current);
    }
  }, [config]);

  const weekDoneCount = (weeks[selectedWeek - 1]?.rows ?? []).filter((r) =>
    r.slots.every((s) => s.result !== undefined)
  ).length;
  const weekTotalCount = weeks[selectedWeek - 1]?.rows.length ?? workoutsPerWeek;

  // Day-level navigation within the selected week
  const [selectedDay, setSelectedDay] = useState(0);
  const [prevSelectedWeek, setPrevSelectedWeek] = useState(selectedWeek);

  if (prevSelectedWeek !== selectedWeek) {
    setPrevSelectedWeek(selectedWeek);
    const weekRows = weeks[selectedWeek - 1]?.rows ?? [];
    const pending = weekRows.findIndex((r) => r.slots.some((s) => s.result === undefined));
    setSelectedDay(pending >= 0 ? pending : 0);
  }

  const dayTabs: readonly DayTab[] = (() => {
    const weekRows = weeks[selectedWeek - 1]?.rows ?? [];
    return weekRows.map((row) => ({
      label: row.dayName,
      isComplete: row.slots.every((s) => s.result !== undefined),
    }));
  })();

  const currentDayInWeek: number = (() => {
    if (selectedWeek !== currentWeekNumber) return -1;
    const weekRows = weeks[selectedWeek - 1]?.rows ?? [];
    return weekRows.findIndex((r) => r.slots.some((s) => s.result === undefined));
  })();

  const selectedRow = weeks[selectedWeek - 1]?.rows[selectedDay];

  const recordAndToast = (workoutIndex: number, slotId: string, value: ResultValue): void => {
    markResult(workoutIndex, slotId, value);
    const row = rows[workoutIndex];
    if (!row) return;
    const slot = row.slots.find((s) => s.slotId === slotId);
    if (!slot) return;
    const isPr = detectGenericPersonalRecord(rows, workoutIndex, slotId, value);
    if (isPr) {
      toast({
        message: `${slot.exerciseName} ${slot.weight} kg`,
        variant: 'pr',
      });
    } else {
      const resultLabel = value === 'success' ? 'Éxito' : 'Fallo';
      toast({
        message: `#${workoutIndex + 1}: ${slot.exerciseName} ${slot.tier.toUpperCase()} — ${resultLabel}`,
        action: {
          label: 'Deshacer',
          onClick: () => undoSpecific(workoutIndex, slotId),
        },
      });
    }
  };

  const scrollToRpeInput = (selector: string): void => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-rpe-input="${selector}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });
  };

  const handleMarkResult = (workoutIndex: number, slotId: string, value: ResultValue): void => {
    const row = rows[workoutIndex];
    if (!row) {
      recordAndToast(workoutIndex, slotId, value);
      return;
    }

    // Would marking this slot complete the workout?
    const otherSlots = row.slots.filter((s) => s.slotId !== slotId);
    const wouldComplete = otherSlots.every((s) => s.result !== undefined);

    if (wouldComplete) {
      // Find first primary slot missing RPE (including the one being marked if it's primary)
      const primaryMissingRpe = row.slots.find((s) => {
        if (s.role !== 'primary') return false;
        const hasResult = s.slotId === slotId || s.result !== undefined;
        return hasResult && s.rpe === undefined;
      });

      if (primaryMissingRpe) {
        setRpeReminder({
          workoutIndex,
          slotId,
          value,
          rpeTarget: `${workoutIndex}-${primaryMissingRpe.slotId}`,
        });
        return;
      }
    }

    recordAndToast(workoutIndex, slotId, value);
  };

  const handleRpeReminderContinue = (): void => {
    if (!rpeReminder) return;
    recordAndToast(rpeReminder.workoutIndex, rpeReminder.slotId, rpeReminder.value);
    setRpeReminder(null);
  };

  const handleRpeReminderAdd = (): void => {
    if (!rpeReminder) return;
    recordAndToast(rpeReminder.workoutIndex, rpeReminder.slotId, rpeReminder.value);
    scrollToRpeInput(rpeReminder.rpeTarget);
    setRpeReminder(null);
  };

  const handleFinishProgram = async (): Promise<void> => {
    await finishProgram();
    onBackToDashboard?.();
  };

  const weeksRef = useRef(weeks);
  weeksRef.current = weeks;

  const jumpToCurrent = (): void => {
    setSelectedWeek(currentWeekNumber);
    const weekRows = weeksRef.current[currentWeekNumber - 1]?.rows ?? [];
    const pendingDay = weekRows.findIndex((r) => r.slots.some((s) => s.result === undefined));
    setSelectedDay(pendingDay >= 0 ? pendingDay : 0);
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
  };

  useEffect(() => {
    if (activeTab !== 'program' || !config) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') setSelectedWeek((w) => Math.max(1, w - 1));
      else if (e.key === 'ArrowRight') setSelectedWeek((w) => Math.min(weeks.length, w + 1));
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, config, weeks.length]);

  const handleSignOut = async (): Promise<void> => {
    await signOut();
    queryClient.clear();
  };

  if (authLoading || user === null) return null;

  if (!definition) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-[var(--text-muted)]">
        Programa desconocido: {programId}
      </div>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-50">
        <AppHeader
          backLabel="Programas"
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
            onFinish={handleFinishProgram}
            onReset={resetAll}
          />
        )}
      </div>

      <div className="max-w-[1300px] mx-auto px-3 sm:px-5 pb-24">
        <GenericSetupForm
          definition={definition}
          initialConfig={config}
          isGenerating={isGenerating}
          onGenerate={generateProgram}
          onUpdateConfig={updateConfig}
        />

        {config && rows.length > 0 && (
          <>
            {/* Tabs */}
            <div
              role="tablist"
              className="flex gap-0 mb-4 sm:mb-8 border-b-2 border-[var(--border-color)]"
            >
              <TabButton
                active={activeTab === 'program'}
                onClick={() => startTransition(() => setActiveTab('program'))}
              >
                Programa
              </TabButton>
              <TabButton
                active={activeTab === 'stats'}
                onClick={() => startTransition(() => setActiveTab('stats'))}
                onMouseEnter={preloadGenericStatsPanel}
                onFocus={preloadGenericStatsPanel}
              >
                Estadísticas
              </TabButton>
            </div>

            {activeTab === 'program' && (
              <>
                {/* Program info */}
                <details className="group bg-[var(--bg-card)] border border-[var(--border-color)] mb-4 sm:mb-8 overflow-hidden">
                  <summary className="font-mono px-5 py-3.5 font-bold cursor-pointer select-none flex justify-between items-center [&::marker]:hidden list-none text-[11px] tracking-widest uppercase">
                    Acerca de {definition.name}
                    <span className="transition-transform duration-200 group-open:rotate-90">
                      &#9656;
                    </span>
                  </summary>
                  <div className="px-5 pb-5 border-t border-[var(--border-light)]">
                    <p className="mt-3 text-[13px] leading-7 text-[var(--text-info)]">
                      {definition.description}
                    </p>
                    {definition.author && (
                      <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                        Por {definition.author}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-[var(--text-muted)]">
                      <span>{totalWorkouts} entrenamientos en total</span>
                      <span>{workoutsPerWeek} por semana</span>
                      <span>Rotación de {definition.days.length} días</span>
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
                <DayNavigator
                  days={dayTabs}
                  selectedDay={selectedDay}
                  currentDay={currentDayInWeek}
                  onSelectDay={setSelectedDay}
                />
                {selectedRow && (
                  <DayView
                    key={`${selectedWeek}-${selectedDay}`}
                    workoutIndex={selectedRow.index}
                    workoutNumber={selectedRow.index + 1}
                    dayName={selectedRow.dayName}
                    isCurrent={selectedRow.index === firstPendingIdx}
                    slots={genericRowToSlots(selectedRow)}
                    onMark={handleMarkResult}
                    onUndo={undoSpecific}
                    onSetAmrapReps={setAmrapReps}
                    onSetRpe={setRpe}
                  />
                )}
              </>
            )}

            {activeTab === 'stats' && (
              <div
                className="transition-opacity duration-150"
                style={{ opacity: isPending ? 0.6 : 1 }}
              >
                <ErrorBoundary
                  fallback={({ reset }) => (
                    <div className="text-center py-16">
                      <p className="text-[var(--text-muted)] mb-4">
                        No se pudieron cargar las estadísticas.
                      </p>
                      <button
                        onClick={reset}
                        className="px-5 py-2 bg-[var(--fill-progress)] text-white font-bold cursor-pointer"
                      >
                        Reintentar
                      </button>
                    </div>
                  )}
                >
                  <Suspense fallback={<StatsSkeleton />}>
                    <GenericStatsPanel definition={definition} rows={rows} />
                  </Suspense>
                </ErrorBoundary>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        open={rpeReminder !== null}
        title="RPE no registrado"
        message="No registraste el RPE del ejercicio principal. El RPE es opcional, pero útil para seguir tu esfuerzo percibido."
        confirmLabel="Añadir RPE"
        cancelLabel="Continuar sin RPE"
        onConfirm={handleRpeReminderAdd}
        onCancel={handleRpeReminderContinue}
      />

      <ToastContainer />
    </>
  );
}
