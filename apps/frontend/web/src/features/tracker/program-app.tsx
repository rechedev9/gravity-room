import { Suspense, useState, useTransition, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ResultValue } from '@gzclp/domain/types';
import { useProgram } from '@/hooks/use-program';
import { useGuestProgram } from '@/hooks/use-guest-program';
import { useSetLogging } from '@/hooks/use-set-logging';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { useToast } from '@/contexts/toast-context';
import { detectGenericPersonalRecord } from '@/lib/pr-detection';
import { deriveJawContext } from '@/lib/jaw-context';
import { useWebMcp } from '@/hooks/use-webmcp';
import { useWakeLock } from '@/hooks/use-wake-lock';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useDayNavigation } from '@/hooks/use-day-navigation';
import { useGraduation } from '@/hooks/use-graduation';
import { useTestWeightModal } from '@/hooks/use-test-weight-modal';
import { generateProgramCsv, downloadCsv } from '@/lib/csv-export';
import { localizedProgramName } from '@/lib/catalog-display';
import { useProgramCompletion } from '@/hooks/use-program-completion';
import { ErrorBoundary } from '@/components/error-boundary';
import { ToastContainer } from '@/components/toast';
import { AppSkeleton } from '@/components/app-skeleton';
import { GraduationPanel } from './graduation-panel';
import { ProgramCompletionScreen } from './program-completion-screen';
import { ProgramTabContent } from './program-tab-content';
import { SetupForm } from './setup-form';
import { StatsSkeleton } from './stats-skeleton';
import { TabButton } from './tab-button';
import { TestWeightModal } from './test-weight-modal';
import { Toolbar } from './toolbar';
import { lazyWithRetry } from '@/lib/lazy-with-retry';

const StatsPanel = lazyWithRetry(() => import('./stats-panel'));
const preloadStatsPanel = (): void => void import('./stats-panel');

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
  const { t } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const { isGuest } = useGuest();

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

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'program' | 'stats'>('program');
  const [isPending, startTransition] = useTransition();
  const workoutsPerWeek = definition?.workoutsPerWeek ?? 4;
  const totalWorkouts = definition?.totalWorkouts ?? 0;
  const completedCount = rows.filter((r) => r.slots.every((s) => s.result !== undefined)).length;

  const firstPendingIdx = (() => {
    const pending = rows.find((r) => r.slots.some((s) => s.result === undefined));
    return pending ? pending.index : -1;
  })();

  const dayNav = useDayNavigation({ totalWorkouts, firstPendingIdx, config });
  const graduation = useGraduation({
    definition,
    config,
    metadata,
    updateMetadata,
    onBackToDashboard,
  });

  const currentDayName = firstPendingIdx >= 0 ? (rows[firstPendingIdx]?.dayName ?? '') : '';
  const jawContext = deriveJawContext(currentDayName);
  const jawStatusNote = jawContext
    ? jawContext.isTestWeek
      ? jawContext.block < 3
        ? t('tracker.jaw_status_test_week', {
            block: jawContext.block,
            next: jawContext.block + 1,
          })
        : t('tracker.jaw_status_final_test_week')
      : t('tracker.jaw_status_progress', {
          block: jawContext.block,
          week: jawContext.week ?? '?',
          testWeek: jawContext.block * 6,
        })
    : undefined;

  const selectedWorkout = rows[dayNav.selectedDayIndex];
  const isDayComplete = selectedWorkout
    ? selectedWorkout.slots.every((s) => s.result !== undefined)
    : false;

  const mutenroshiBlocksCompletion =
    graduation.isMutenroshi && !graduation.graduationState.allPassed;

  const { completionData, handleFinishProgram, handleCompletionDismiss, handleViewProfile } =
    useProgramCompletion({
      instanceId,
      programId,
      definition,
      config,
      rows,
      resultTimestamps,
      mutenroshiBlocksCompletion,
      finishProgram,
      onBackToDashboard,
      onGoToProfile,
    });

  const recordAndToast = (workoutIndex: number, slotId: string, value: ResultValue): void => {
    markResult(workoutIndex, slotId, value);
    const row = rows[workoutIndex];
    if (!row) return;
    const slot = row.slots.find((s) => s.slotId === slotId);
    if (!slot) return;
    const isPr = detectGenericPersonalRecord(rows, workoutIndex, slotId, value);
    if (isPr) {
      toast({ message: `${slot.exerciseName} ${slot.weight} kg`, variant: 'pr' });
    } else {
      const resultLabel = value === 'success' ? t('common.success') : t('common.failed');
      toast({
        message: t('tracker.result_toast', {
          index: workoutIndex + 1,
          exercise: slot.exerciseName,
          tier: slot.tier.toUpperCase(),
          result: resultLabel,
        }),
        action: {
          label: t('tracker.toolbar.undo_button'),
          onClick: () => testWeight.handleUndoSpecific(workoutIndex, slotId),
        },
      });
    }
  };

  const testWeight = useTestWeightModal({
    config,
    updateConfigAsync,
    clearSetLogs,
    undoSpecific,
    recordAndToast: (workoutIndex, slotId) => recordAndToast(workoutIndex, slotId, 'success'),
    toast,
  });

  const handleMarkResult = (workoutIndex: number, slotId: string, value: ResultValue): void => {
    clearSetLogs(workoutIndex, slotId);

    const row = rows[workoutIndex];
    if (!row) {
      recordAndToast(workoutIndex, slotId, value);
      return;
    }

    const slot = row.slots.find((s) => s.slotId === slotId);
    if (slot?.isTestSlot === true) {
      testWeight.openTestWeightModal({
        workoutIndex,
        slotId,
        exerciseName: slot.exerciseName,
        prefillWeight: slot.weight,
        propagatesTo: slot.propagatesTo,
      });
      return;
    }

    if (typeof navigator.vibrate === 'function') navigator.vibrate(50);
    recordAndToast(workoutIndex, slotId, value);
  };

  useWakeLock(isViewActive && activeTab === 'program' && config !== null);

  const handleSetTap = (
    workoutIndex: number,
    slotId: string,
    setIndex: number,
    reps: number,
    weight?: number,
    rpe?: number
  ): void => logSet(workoutIndex, slotId, setIndex, reps, weight, rpe);

  const firstPendingSlot = useMemo(() => {
    if (firstPendingIdx < 0) return null;
    const row = rows[firstPendingIdx];
    if (!row) return null;
    const slot = row.slots.find((s) => s.result === undefined);
    return slot ?? null;
  }, [rows, firstPendingIdx]);

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
      if (undoHistory.length > 0) undoLast();
    },
    onPrevDay: dayNav.handlePrevDay,
    onNextDay: dayNav.handleNextDay,
  });

  const handleResetAll = (): void => resetAll(() => onProgramReset?.());

  const handleExportCsv = (): void => {
    if (isGuest) {
      toast({ message: t('tracker.guest_export_message') });
      return;
    }
    if (!definition || rows.length === 0) return;
    const csv = generateProgramCsv(rows, workoutsPerWeek);
    const date = new Date().toISOString().slice(0, 10);
    const filenameBase = localizedProgramName(t, definition.id, definition.name);
    downloadCsv(csv, `${filenameBase}-${date}.csv`);
  };

  if (!isGuest && (authLoading || user === null)) return null;
  if (isLoading && !definition) return <AppSkeleton />;

  if (!definition) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-4 px-5">
        <p className="text-muted text-sm text-center">
          {t('tracker.catalog_removed', { programId })}
        </p>
        {(instanceId ?? programData.activeInstanceId) && (
          <button
            type="button"
            onClick={handleResetAll}
            className="px-5 py-2.5 text-xs font-bold cursor-pointer bg-btn text-btn-text border-2 border-btn-ring hover:bg-btn-active hover:text-btn-active-text transition-colors"
          >
            {t('tracker.delete_and_return')}
          </button>
        )}
        {onBackToDashboard && (
          <button
            type="button"
            onClick={onBackToDashboard}
            className="text-xs text-muted hover:text-title cursor-pointer transition-colors"
          >
            {t('tracker.back_to_panel')}
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="sticky top-0 z-50">
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

        {graduation.isMutenroshi && config && graduation.graduationTargets.length > 0 && (
          <div className="mb-6">
            <GraduationPanel
              targets={graduation.graduationTargets}
              achieved={graduation.graduationState}
              config={config}
              onStartJaw={graduation.handleGraduationStartJaw}
              onDismiss={graduation.handleGraduationDismiss}
            />
          </div>
        )}

        {config && rows.length > 0 && (
          <>
            <div role="tablist" className="flex gap-0 mb-4 sm:mb-8 border-b-2 border-rule">
              <TabButton
                id="tab-program"
                controls="panel-program"
                active={activeTab === 'program'}
                onClick={() => startTransition(() => setActiveTab('program'))}
              >
                {t('tracker.program')}
              </TabButton>
              <TabButton
                id="tab-stats"
                controls="panel-stats"
                active={activeTab === 'stats'}
                onClick={() => {
                  if (isGuest) {
                    toast({ message: t('tracker.guest_stats_message') });
                    return;
                  }
                  startTransition(() => setActiveTab('stats'));
                }}
                onMouseEnter={isGuest ? undefined : preloadStatsPanel}
                onFocus={isGuest ? undefined : preloadStatsPanel}
              >
                <span className={isGuest ? 'opacity-50' : ''}>{t('tracker.statistics')}</span>
              </TabButton>
            </div>

            {activeTab === 'program' && (
              <ProgramTabContent
                definition={definition}
                isGuest={isGuest}
                selectedWorkout={selectedWorkout}
                selectedDayIndex={dayNav.selectedDayIndex}
                currentDayIndex={firstPendingIdx}
                totalWorkouts={totalWorkouts}
                isDayComplete={isDayComplete}
                viewMode={dayNav.viewMode}
                workoutsPerWeek={workoutsPerWeek}
                onPrevDay={dayNav.handlePrevDay}
                onNextDay={dayNav.handleNextDay}
                onGoToCurrent={dayNav.handleGoToCurrent}
                onToggleView={dayNav.handleToggleView}
                slotActions={{
                  onMark: handleMarkResult,
                  onUndo: testWeight.handleUndoSpecific,
                  onSetAmrapReps: setAmrapReps,
                  onSetRpe: setRpe,
                  onSetTap: handleSetTap,
                  getSetLogs,
                  isSlotLogging,
                }}
              />
            )}

            {activeTab === 'stats' && (
              <div
                id="panel-stats"
                role="tabpanel"
                aria-labelledby="tab-stats"
                className="max-w-2xl mx-auto transition-opacity duration-150"
                style={{ opacity: isPending ? 0.6 : 1 }}
              >
                <ErrorBoundary
                  fallback={({ reset }) => (
                    <div className="text-center py-16">
                      <p className="text-muted mb-4">{t('tracker.stats_load_error')}</p>
                      <button
                        onClick={reset}
                        className="px-5 py-2 bg-accent text-white font-bold cursor-pointer"
                      >
                        {t('tracker.retry')}
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

      <TestWeightModal
        isOpen={testWeight.testWeightModal !== null}
        liftName={testWeight.testWeightModal?.exerciseName ?? ''}
        hasPropagationTarget={testWeight.testWeightModal?.propagatesTo !== undefined}
        defaultWeight={testWeight.testWeightModal?.prefillWeight ?? 0}
        loading={testWeight.testWeightLoading}
        onConfirm={testWeight.handleTestWeightConfirm}
        onCancel={testWeight.handleTestWeightCancel}
      />

      <ToastContainer />

      {completionData && definition && (
        <ProgramCompletionScreen
          programName={localizedProgramName(t, definition.id, definition.name)}
          completion={completionData.completion}
          personalRecords={completionData.personalRecords}
          oneRMEstimates={completionData.oneRMEstimates}
          totalVolume={completionData.totalVolume}
          onViewProfile={handleViewProfile}
          onBackToDashboard={handleCompletionDismiss}
        />
      )}
    </>
  );
}
