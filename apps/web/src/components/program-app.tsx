import { Suspense, useState, useTransition, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { ResultValue } from '@gzclp/shared/types';
import { computeGraduationTargets } from '@gzclp/shared/graduation';
import type { GraduationState } from '@gzclp/shared/graduation';
import { isRecord } from '@gzclp/shared/type-guards';
import { useProgram } from '@/hooks/use-program';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { detectGenericPersonalRecord } from '@/lib/pr-detection';
import { computeProfileData, compute1RMData } from '@/lib/profile-stats';
import { useWebMcp } from '@/hooks/use-webmcp';
import { useViewMode } from '@/hooks/use-view-mode';
import { useWakeLock } from '@/hooks/use-wake-lock';

import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { generateProgramCsv, downloadCsv } from '@/lib/csv-export';
import { AppHeader } from './app-header';
import { ConfirmDialog } from './confirm-dialog';
import { DayNavigator } from './day-navigator';
import { DayView } from './day-view';
import { ErrorBoundary } from './error-boundary';
import { GraduationPanel } from './graduation-panel';
import { ProgramCompletionScreen } from './program-completion-screen';

import { SetupForm } from './setup-form';
import { StatsSkeleton } from './stats-skeleton';
import { TabButton } from './tab-button';
import { ToastContainer } from './toast';
import { Toolbar } from './toolbar';
import { ViewToggle } from './view-toggle';
import { WeekNavigator } from './week-navigator';
import { WeekTable } from './week-table';
import { AppSkeleton } from './app-skeleton';
import { lazyWithRetry } from '@/lib/lazy-with-retry';

const StatsPanel = lazyWithRetry(() => import('./stats-panel'));
const preloadStatsPanel = (): void => {
  void import('./stats-panel');
};

interface ProgramAppProps {
  readonly programId: string;
  readonly instanceId?: string;
  readonly isActive?: boolean;
  readonly onBackToDashboard?: () => void;
  readonly onProgramReset?: () => void;
  readonly onGoToProfile?: () => void;
}

export function ProgramApp({
  programId,
  instanceId,
  isActive: isViewActive = true,
  onBackToDashboard,
  onProgramReset,
  onGoToProfile,
}: ProgramAppProps): React.ReactNode {
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
    metadata,
    rows,
    undoHistory,
    resultTimestamps,
    isLoading,
    isGenerating,
    generateProgram,
    updateConfig,
    updateMetadata,
    markResult,
    setAmrapReps,
    setRpe,
    undoSpecific,
    undoLast,
    finishProgram,
    isFinishing,
    resetAll,
  } = useProgram(programId, instanceId);

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

  const [showCompletion, setShowCompletion] = useState(false);

  // Graduation state for MUTENROSHI
  const isMutenroshi = definition?.displayMode === 'blocks';
  const displayMode = definition?.displayMode;

  const graduationState = useMemo((): GraduationState => {
    const defaultState: GraduationState = {
      squat: false,
      bench: false,
      deadlift: false,
      allPassed: false,
    };
    if (!isRecord(metadata)) return defaultState;
    const grad = metadata.graduation;
    if (!isRecord(grad)) return defaultState;
    return {
      squat: grad.squat === true,
      bench: grad.bench === true,
      deadlift: grad.deadlift === true,
      allPassed: grad.allPassed === true,
    };
  }, [metadata]);

  const graduationTargets = useMemo(() => {
    if (!isMutenroshi || !config) return [];
    const bodyweight = typeof config.bodyweight === 'number' ? config.bodyweight : 0;
    const gender = typeof config.gender === 'string' ? config.gender : 'male';
    const rounding = typeof config.rounding === 'string' ? parseFloat(config.rounding) : 2.5;
    return computeGraduationTargets(bodyweight, gender, rounding);
  }, [isMutenroshi, config]);

  const handleGraduationStartJaw = (estimatedTMs: Record<string, number>): void => {
    // Persist estimated TMs and graduation acknowledgment in metadata
    updateMetadata({ graduation: { ...graduationState, allPassed: true }, estimatedTMs });
    onBackToDashboard?.();
  };

  const handleGraduationDismiss = (): void => {
    // Persist graduation acknowledgment so panel state survives reloads
    updateMetadata({ graduation: { ...graduationState, dismissed: true } });
  };

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

  // View mode: card (mobile-first) / table (desktop-first) toggle
  const { viewMode, toggle: toggleViewMode } = useViewMode();

  // Wake lock: keep screen on during active tracker session (gated by isViewActive)
  useWakeLock(isViewActive && activeTab === 'program' && config !== null);

  // Card mode: day selection within the current week
  const weekRows = weeks[selectedWeek - 1]?.rows ?? [];

  const currentDayInWeek = (() => {
    const idx = weekRows.findIndex((r) => r.slots.some((s) => s.result === undefined));
    return idx >= 0 ? idx : 0;
  })();

  const [selectedDay, setSelectedDay] = useState<number>(0);

  // Reset selectedDay when week changes
  useEffect(() => {
    setSelectedDay(currentDayInWeek);
  }, [selectedWeek, currentDayInWeek]);

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

    // Haptic feedback on supported devices
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(50);
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

  const completionSessionKey = instanceId !== undefined ? `completion-shown-${instanceId}` : null;

  const handleFinishProgram = async (): Promise<void> => {
    // Check sessionStorage suppression: skip the screen if already shown
    if (completionSessionKey && sessionStorage.getItem(completionSessionKey) === '1') {
      await finishProgram();
      onBackToDashboard?.();
      return;
    }

    await finishProgram();

    // Mark as shown so refresh won't re-trigger
    if (completionSessionKey) {
      sessionStorage.setItem(completionSessionKey, '1');
    }
    setShowCompletion(true);
  };

  const handleCompletionDismiss = (): void => {
    setShowCompletion(false);
    onBackToDashboard?.();
  };

  const handleViewProfile = (): void => {
    setShowCompletion(false);
    onGoToProfile?.();
  };

  const handleResetAll = (): void => {
    resetAll(() => onProgramReset?.());
  };

  const handleExportCsv = (): void => {
    if (!definition || rows.length === 0) return;
    const csv = generateProgramCsv(rows, workoutsPerWeek);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `${definition.name}-${date}.csv`);
  };

  const jumpToCurrent = (): void => {
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
  };

  // Derive first pending slot for keyboard shortcuts
  const firstPendingSlot = (() => {
    if (firstPendingIdx < 0) return null;
    const row = rows[firstPendingIdx];
    if (!row) return null;
    const slot = row.slots.find((s) => s.result === undefined);
    return slot ?? null;
  })();

  // Keyboard shortcuts: s/f/u + ArrowLeft/ArrowRight (gated by isViewActive)
  useKeyboardShortcuts({
    isActive: isViewActive && activeTab === 'program' && config !== null,
    onSuccess: () => {
      if (firstPendingSlot !== null) {
        handleMarkResult(firstPendingIdx, firstPendingSlot.slotId, 'success');
      }
    },
    onFail: () => {
      if (firstPendingSlot !== null) {
        handleMarkResult(firstPendingIdx, firstPendingSlot.slotId, 'fail');
      }
    },
    onUndo: () => {
      if (undoHistory.length > 0) {
        undoLast();
      }
    },
    onPrevWeek: () => setSelectedWeek((w) => Math.max(1, w - 1)),
    onNextWeek: () => setSelectedWeek((w) => Math.min(weeks.length, w + 1)),
  });

  const handleSignOut = async (): Promise<void> => {
    await signOut();
    queryClient.clear();
  };

  if (authLoading || user === null) return null;

  if (isLoading && !definition) return <AppSkeleton />;

  if (!definition) {
    return (
      <div className="min-h-dvh flex items-center justify-center text-muted">
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
            isFinishing={isFinishing}
            onUndo={undoLast}
            onFinish={handleFinishProgram}
            onReset={handleResetAll}
            onExportCsv={handleExportCsv}
          />
        )}
      </div>

      <div className="max-w-[1300px] mx-auto px-3 sm:px-5 pb-24">
        <SetupForm
          definition={definition}
          initialConfig={config}
          isGenerating={isGenerating}
          onGenerate={generateProgram}
          onUpdateConfig={updateConfig}
        />

        {/* Graduation panel for MUTENROSHI programs */}
        {isMutenroshi && config && graduationTargets.length > 0 && (
          <div className="mb-6">
            <GraduationPanel
              targets={graduationTargets}
              achieved={graduationState}
              config={config}
              onStartJaw={handleGraduationStartJaw}
              onDismiss={handleGraduationDismiss}
            />
          </div>
        )}

        {config && rows.length > 0 && (
          <>
            {/* Tabs */}
            <div role="tablist" className="flex gap-0 mb-4 sm:mb-8 border-b-2 border-rule">
              <TabButton
                id="tab-program"
                controls="panel-program"
                active={activeTab === 'program'}
                onClick={() => startTransition(() => setActiveTab('program'))}
              >
                Programa
              </TabButton>
              <TabButton
                id="tab-stats"
                controls="panel-stats"
                active={activeTab === 'stats'}
                onClick={() => startTransition(() => setActiveTab('stats'))}
                onMouseEnter={preloadStatsPanel}
                onFocus={preloadStatsPanel}
              >
                Estadísticas
              </TabButton>
            </div>

            {activeTab === 'program' && (
              <div id="panel-program" role="tabpanel" aria-labelledby="tab-program">
                {/* Program info */}
                <details className="group bg-card border border-rule mb-4 sm:mb-8 overflow-hidden">
                  <summary className="font-mono px-5 py-3.5 font-bold cursor-pointer select-none flex justify-between items-center [&::marker]:hidden list-none text-[11px] tracking-widest uppercase">
                    Acerca de {definition.name}
                    <span className="transition-transform duration-200 group-open:rotate-90">
                      &#9656;
                    </span>
                  </summary>
                  <div className="px-5 pb-5 border-t border-rule-light">
                    <p className="mt-3 text-[13px] leading-7 text-info">{definition.description}</p>
                    {definition.author && (
                      <p className="mt-2 text-[11px] text-muted">Por {definition.author}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-muted">
                      <span>{totalWorkouts} entrenamientos en total</span>
                      <span>{workoutsPerWeek} por semana</span>
                      <span>Rotación de {definition.days.length} días</span>
                    </div>
                  </div>
                </details>

                <div className="flex items-center justify-end mb-4">
                  <ViewToggle viewMode={viewMode} onToggle={toggleViewMode} />
                </div>

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

                {viewMode === 'table' ? (
                  <WeekTable
                    weekRows={weekRows}
                    firstPendingIndex={firstPendingIdx}
                    onMark={handleMarkResult}
                    onUndo={undoSpecific}
                    onSetAmrapReps={setAmrapReps}
                    onSetRpe={setRpe}
                  />
                ) : (
                  <>
                    <DayNavigator
                      days={weekRows.map((row) => ({
                        label: row.dayName,
                        isComplete: row.slots.every((s) => s.result !== undefined),
                      }))}
                      selectedDay={selectedDay}
                      currentDay={currentDayInWeek}
                      onSelectDay={setSelectedDay}
                    />
                    <div id="day-panel" role="tabpanel" aria-labelledby={`day-tab-${selectedDay}`}>
                      {weekRows[selectedDay] !== undefined && (
                        <DayView
                          workoutIndex={weekRows[selectedDay].index}
                          workoutNumber={weekRows[selectedDay].index + 1}
                          dayName={weekRows[selectedDay].dayName}
                          isCurrent={weekRows[selectedDay].index === firstPendingIdx}
                          instanceId={instanceId}
                          displayMode={displayMode}
                          slots={weekRows[selectedDay].slots.map((s) => ({
                            key: s.slotId,
                            exerciseName: s.exerciseName,
                            tierLabel: s.tier.toUpperCase(),
                            tier: s.tier,
                            role: s.role ?? 'accessory',
                            weight: s.weight,
                            scheme: `${s.sets}\u00d7${s.reps}${s.repsMax !== undefined ? `\u2013${s.repsMax}` : ''}${s.isAmrap ? '+' : ''}`,
                            stage: s.stage,
                            showStage: s.stagesCount > 1,
                            isAmrap: s.isAmrap,
                            result: s.result,
                            amrapReps: s.amrapReps,
                            rpe: s.rpe,
                            showRpe: s.role === 'primary',
                            isChanged: s.isChanged,
                            isDeload: s.isDeload,
                            notes: s.notes,
                          }))}
                          onMark={handleMarkResult}
                          onUndo={undoSpecific}
                          onSetAmrapReps={setAmrapReps}
                          onSetRpe={setRpe}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'stats' && (
              <div
                id="panel-stats"
                role="tabpanel"
                aria-labelledby="tab-stats"
                className="transition-opacity duration-150"
                style={{ opacity: isPending ? 0.6 : 1 }}
              >
                <ErrorBoundary
                  fallback={({ reset }) => (
                    <div className="text-center py-16">
                      <p className="text-muted mb-4">No se pudieron cargar las estadísticas.</p>
                      <button
                        onClick={reset}
                        className="px-5 py-2 bg-accent text-white font-bold cursor-pointer"
                      >
                        Reintentar
                      </button>
                    </div>
                  )}
                >
                  <Suspense fallback={<StatsSkeleton />}>
                    <StatsPanel
                      definition={definition}
                      rows={rows}
                      resultTimestamps={resultTimestamps}
                    />
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

      {showCompletion &&
        definition &&
        config &&
        !(isMutenroshi && !graduationState.allPassed) &&
        (() => {
          const profileData = computeProfileData(rows, definition, config, resultTimestamps);
          const oneRMEstimates = compute1RMData(rows, definition);
          return (
            <ProgramCompletionScreen
              programName={definition.name}
              completion={profileData.completion}
              personalRecords={profileData.personalRecords}
              oneRMEstimates={oneRMEstimates}
              totalVolume={profileData.volume.totalVolume}
              onViewProfile={handleViewProfile}
              onBackToDashboard={handleCompletionDismiss}
            />
          );
        })()}
    </>
  );
}
