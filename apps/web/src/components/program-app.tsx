import { Suspense, useState, useTransition, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { ResultValue } from '@gzclp/shared/types';
import { computeGraduationTargets } from '@gzclp/shared/graduation';
import type { GraduationState } from '@gzclp/shared/graduation';
import { isRecord } from '@gzclp/shared/type-guards';
import { useProgram } from '@/hooks/use-program';
import { useGuestProgram } from '@/hooks/use-guest-program';
import { useSetLogging } from '@/hooks/use-set-logging';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { useToast } from '@/contexts/toast-context';
import { detectGenericPersonalRecord } from '@/lib/pr-detection';
import { computeProfileData, compute1RMData } from '@/lib/profile-stats';
import { useWebMcp } from '@/hooks/use-webmcp';
import { useWakeLock } from '@/hooks/use-wake-lock';

import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { generateProgramCsv, downloadCsv } from '@/lib/csv-export';
import { AppHeader } from './app-header';
import { ConfirmDialog } from './confirm-dialog';
import { ErrorBoundary } from './error-boundary';
import { GuestBanner } from './guest-banner';
import { GraduationPanel } from './graduation-panel';
import { ProgramCompletionScreen } from './program-completion-screen';

import { SetupForm } from './setup-form';
import { StatsSkeleton } from './stats-skeleton';
import { TabButton } from './tab-button';
import { TestWeightModal } from './test-weight-modal';
import { ToastContainer } from './toast';
import { Toolbar } from './toolbar';
import { DayNavigator } from './day-navigator';
import { DayView } from './day-view';
import { DetailedDayView } from './detailed-day-view';
import { AppSkeleton } from './app-skeleton';
import { getViewPreference, saveViewPreference } from '@/lib/view-preference';
import type { ViewMode } from '@/lib/view-preference';
import { lazyWithRetry } from '@/lib/lazy-with-retry';

const StatsPanel = lazyWithRetry(() => import('./stats-panel'));
const preloadStatsPanel = (): void => {
  void import('./stats-panel');
};

const GUEST_STATS_MSG = 'Crea una cuenta para ver estadísticas';
const GUEST_EXPORT_MSG = 'Crea una cuenta para exportar tus datos';

interface TestWeightModalState {
  readonly workoutIndex: number;
  readonly slotId: string;
  readonly exerciseName: string;
  readonly prefillWeight: number;
  readonly propagatesTo: string | undefined;
}

interface ConfigSnapshot {
  readonly propagatesTo: string;
  readonly previousValue: number | string | undefined;
}

interface JawContext {
  readonly block: 1 | 2 | 3;
  readonly week: number | null;
  readonly isTestWeek: boolean;
  readonly group: string;
}

function deriveJawContext(dayName: string): JawContext | null {
  const blockMatch = dayName.match(/JAW (?:B|Bloque )(\d)/);
  if (!blockMatch) return null;
  const blockStr = blockMatch[1];
  if (blockStr !== '1' && blockStr !== '2' && blockStr !== '3') return null;
  const block: 1 | 2 | 3 = blockStr === '1' ? 1 : blockStr === '2' ? 2 : 3;
  const semMatch = dayName.match(/Sem\.\s*(\d+)/);
  const isTestWeek = dayName.includes('Test Maximo') || dayName.includes('Recuperacion');
  const week = semMatch ? Number(semMatch[1]) : isTestWeek ? block * 6 : null;
  return { block, week, isTestWeek, group: `JAW Bloque ${block} — TM` };
}

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
  const { isGuest } = useGuest();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user === null && !isGuest) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, isGuest, navigate]);

  // Both hooks are called unconditionally (React rules of hooks).
  // useProgram's internal queries are disabled when user is null.
  // useGuestProgram only fetches the public catalog (already cached).
  const authData = useProgram(programId, instanceId);
  const guestData = useGuestProgram(programId);
  const programData = isGuest ? guestData : authData;

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
    updateConfigAsync,
  } = programData;

  const {
    logSet,
    clearSetLogs,
    getSetLogs,
    isLogging: isSlotLogging,
  } = useSetLogging(markResult, rows, definition);

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

  // Test weight modal state: blocks result recording until user confirms weight
  const [testWeightModal, setTestWeightModal] = useState<TestWeightModalState | null>(null);
  const [testWeightLoading, setTestWeightLoading] = useState(false);
  // Stores previous config values for test slots to enable undo reversion
  const configSnapshotRef = useRef<Map<string, ConfigSnapshot>>(new Map());

  // Graduation state for MUTENROSHI
  const isMutenroshi = definition?.displayMode === 'blocks';

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

  const currentDayName = firstPendingIdx >= 0 ? (rows[firstPendingIdx]?.dayName ?? '') : '';
  const jawContext = deriveJawContext(currentDayName);
  const jawStatusNote = jawContext
    ? jawContext.isTestWeek
      ? jawContext.block < 3
        ? `JAW Bloque ${jawContext.block} · Semana de test — actualiza los TM del Bloque ${jawContext.block + 1} al terminar.`
        : 'JAW Bloque 3 · Semana de test final — último bloque de JAW.'
      : `JAW Bloque ${jawContext.block} · Sem. ${jawContext.week ?? '?'}/18 · Test en sem. ${jawContext.block * 6}.`
    : undefined;

  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(0);
  const [viewMode, setViewMode] = useState<ViewMode>(() => getViewPreference());
  const currentDayIndex = firstPendingIdx;
  const selectedWorkout = rows[selectedDayIndex];
  const isDayComplete = selectedWorkout
    ? selectedWorkout.slots.every((s) => s.result !== undefined)
    : false;

  useEffect(() => {
    if (firstPendingIdx >= 0) setSelectedDayIndex(firstPendingIdx);
  }, [config]);

  // Wake lock: keep screen on during active tracker session (gated by isViewActive)
  useWakeLock(isViewActive && activeTab === 'program' && config !== null);

  const handleSetTap = (
    workoutIndex: number,
    slotId: string,
    setIndex: number,
    reps: number,
    weight?: number,
    rpe?: number
  ): void => {
    logSet(workoutIndex, slotId, setIndex, reps, weight, rpe);
  };

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
          onClick: () => handleUndoSpecific(workoutIndex, slotId),
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
    // Clear any partial set logs when using pass/fail as override
    clearSetLogs(workoutIndex, slotId);

    const row = rows[workoutIndex];
    if (!row) {
      recordAndToast(workoutIndex, slotId, value);
      return;
    }

    // Test slot intercept: open weight-capture modal instead of recording directly
    const slot = row.slots.find((s) => s.slotId === slotId);
    if (slot?.isTestSlot === true) {
      setTestWeightModal({
        workoutIndex,
        slotId,
        exerciseName: slot.exerciseName,
        prefillWeight: slot.weight,
        propagatesTo: slot.propagatesTo,
      });
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

  const handleTestWeightConfirm = async (weight: number): Promise<void> => {
    if (!testWeightModal) return;
    const { workoutIndex, slotId, propagatesTo } = testWeightModal;

    setTestWeightLoading(true);
    try {
      if (propagatesTo !== undefined && config) {
        // Snapshot the current config value before overwriting
        const snapshotKey = `${workoutIndex}:${slotId}`;
        configSnapshotRef.current.set(snapshotKey, {
          propagatesTo,
          previousValue: config[propagatesTo],
        });

        try {
          await updateConfigAsync({ [propagatesTo]: weight });
        } catch {
          // Config update failed: remove snapshot and show error
          configSnapshotRef.current.delete(snapshotKey);
          toast({ message: 'No se pudo actualizar la configuracion. Intentalo de nuevo.' });
          setTestWeightLoading(false);
          setTestWeightModal(null);
          return;
        }
      }

      // Config updated (or no propagation needed) — record result and show toast
      recordAndToast(workoutIndex, slotId, 'success');
      setTestWeightModal(null);
    } finally {
      setTestWeightLoading(false);
    }
  };

  const handleTestWeightCancel = (): void => {
    setTestWeightModal(null);
  };

  // Wraps undoSpecific to also revert config for test slots and clear set logs
  const handleUndoSpecific = (workoutIndex: number, slotId: string): void => {
    // Clear any local set logs for this slot
    clearSetLogs(workoutIndex, slotId);

    const snapshotKey = `${workoutIndex}:${slotId}`;
    const snapshot = configSnapshotRef.current.get(snapshotKey);

    // Always undo the result first
    undoSpecific(workoutIndex, slotId);

    // Revert config if we have a snapshot
    if (snapshot) {
      configSnapshotRef.current.delete(snapshotKey);
      const revertValue = snapshot.previousValue;
      if (revertValue !== undefined) {
        updateConfigAsync({ [snapshot.propagatesTo]: revertValue }).catch(() => {
          toast({ message: 'No se pudo revertir la configuracion del bloque siguiente.' });
        });
      }
    }
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
    if (isGuest) {
      toast({ message: GUEST_EXPORT_MSG });
      return;
    }
    if (!definition || rows.length === 0) return;
    const csv = generateProgramCsv(rows, workoutsPerWeek);
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(csv, `${definition.name}-${date}.csv`);
  };

  const handlePrevDay = (): void => setSelectedDayIndex((i) => Math.max(0, i - 1));
  const handleNextDay = (): void => setSelectedDayIndex((i) => Math.min(totalWorkouts - 1, i + 1));
  const handleGoToCurrent = (): void => {
    if (firstPendingIdx >= 0) setSelectedDayIndex(firstPendingIdx);
  };

  const handleToggleView = (): void => {
    const next: ViewMode = viewMode === 'detailed' ? 'compact' : 'detailed';
    setViewMode(next);
    saveViewPreference(next);
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
    onPrevDay: handlePrevDay,
    onNextDay: handleNextDay,
  });

  const handleSignOut = async (): Promise<void> => {
    await signOut();
    queryClient.clear();
  };

  if (!isGuest && (authLoading || user === null)) return null;

  if (isLoading && !definition) return <AppSkeleton />;

  if (!definition) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-5">
        <p className="text-muted text-sm text-center">
          El programa <span className="font-mono">{programId}</span> ya no existe en el catálogo.
        </p>
        {instanceId && (
          <button
            type="button"
            onClick={handleResetAll}
            className="px-5 py-2.5 text-xs font-bold cursor-pointer bg-btn text-btn-text border-2 border-btn-ring hover:bg-btn-active hover:text-btn-active-text transition-colors"
          >
            Eliminar programa y volver
          </button>
        )}
        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="text-xs text-muted hover:text-title cursor-pointer transition-colors"
          >
            Volver al panel
          </button>
        )}
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
          statusNote={jawStatusNote}
          activeGroup={jawContext?.group}
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
                onClick={() => {
                  if (isGuest) {
                    toast({ message: GUEST_STATS_MSG });
                    return;
                  }
                  startTransition(() => setActiveTab('stats'));
                }}
                onMouseEnter={isGuest ? undefined : preloadStatsPanel}
                onFocus={isGuest ? undefined : preloadStatsPanel}
              >
                <span className={isGuest ? 'opacity-50' : ''}>Estadísticas</span>
              </TabButton>
            </div>

            {activeTab === 'program' && (
              <div id="panel-program" role="tabpanel" aria-labelledby="tab-program">
                {isGuest && <GuestBanner className="mb-4 sm:mb-8" />}

                {/* Program info */}
                <details className="group bg-card border border-rule mb-4 sm:mb-8 overflow-hidden">
                  <summary className="px-5 py-3.5 font-bold cursor-pointer select-none flex justify-between items-center [&::marker]:hidden list-none text-xs tracking-wide">
                    Acerca de {definition.name}
                    <span className="transition-transform duration-200 group-open:rotate-90">
                      &#9656;
                    </span>
                  </summary>
                  <div className="px-5 pb-5 border-t border-rule-light">
                    <p className="mt-3 text-sm leading-7 text-info">{definition.description}</p>
                    {definition.author && (
                      <p className="mt-2 text-xs text-muted">Por {definition.author}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted">
                      <span>{totalWorkouts} entrenamientos en total</span>
                      <span>{workoutsPerWeek} por semana</span>
                      <span>Rotación de {definition.days.length} días</span>
                    </div>
                  </div>
                </details>

                <DayNavigator
                  selectedDayIndex={selectedDayIndex}
                  totalDays={totalWorkouts}
                  currentDayIndex={currentDayIndex}
                  dayName={selectedWorkout?.dayName ?? ''}
                  isDayComplete={isDayComplete}
                  onPrev={handlePrevDay}
                  onNext={handleNextDay}
                  onGoToCurrent={handleGoToCurrent}
                />

                {/* View mode toggle */}
                <div className="flex justify-end mb-2">
                  <button
                    type="button"
                    onClick={handleToggleView}
                    aria-label={
                      viewMode === 'detailed'
                        ? 'Cambiar a vista compacta'
                        : 'Cambiar a vista detallada'
                    }
                    className="text-2xs font-bold text-muted hover:text-main tracking-wide uppercase cursor-pointer transition-colors"
                  >
                    {viewMode === 'detailed' ? 'Vista compacta' : 'Vista detallada'}
                  </button>
                </div>

                {selectedWorkout &&
                  (viewMode === 'detailed' ? (
                    <DetailedDayView
                      workout={selectedWorkout}
                      isCurrent={selectedDayIndex === currentDayIndex}
                      onMark={handleMarkResult}
                      onUndo={handleUndoSpecific}
                      onSetAmrapReps={setAmrapReps}
                      onSetRpe={setRpe}
                      onSetTap={handleSetTap}
                      getSetLogs={getSetLogs}
                      isSlotLogging={isSlotLogging}
                    />
                  ) : (
                    <DayView
                      workout={selectedWorkout}
                      isCurrent={selectedDayIndex === currentDayIndex}
                      onMark={handleMarkResult}
                      onUndo={handleUndoSpecific}
                      onSetAmrapReps={setAmrapReps}
                      onSetRpe={setRpe}
                      onSetTap={handleSetTap}
                      getSetLogs={getSetLogs}
                      isSlotLogging={isSlotLogging}
                    />
                  ))}
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

      <TestWeightModal
        isOpen={testWeightModal !== null}
        liftName={testWeightModal?.exerciseName ?? ''}
        hasPropagationTarget={testWeightModal?.propagatesTo !== undefined}
        defaultWeight={testWeightModal?.prefillWeight ?? 0}
        loading={testWeightLoading}
        onConfirm={handleTestWeightConfirm}
        onCancel={handleTestWeightCancel}
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
