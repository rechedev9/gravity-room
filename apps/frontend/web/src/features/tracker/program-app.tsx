import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ResultValue } from '@gzclp/domain/types';
import { useProgram } from '@/hooks/use-program';
import { useGuestProgram } from '@/hooks/use-guest-program';
import { useSetLogging } from '@/hooks/use-set-logging';
import { buildSetLogsStorageKey } from '@/lib/set-logs-storage';
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
import { ToastContainer } from '@/components/toast';
import { AppSkeleton } from '@/components/app-skeleton';
import { GraduationPanel } from './graduation-panel';
import { ProgramCompletionScreen } from './program-completion-screen';
import { ProgramTabContent } from './program-tab-content';
import { SessionChrome } from './session-chrome';
import { SetupForm } from './setup-form';
import { TestWeightModal } from './test-weight-modal';
import { RestTimer } from './rest-timer';
import { plannedConfirmableSets, restSecondsForRole } from './rest-timer-policy';

const MAX_BACKUP_FILE_BYTES = 1_048_576;

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

  // Both hooks must be called (Rules of Hooks), but only the active path
  // fetches / touches storage. The idle path is a cheap no-op.
  const authData = useProgram(programId, instanceId, { enabled: !isGuest });
  const guestData = useGuestProgram(programId, { enabled: isGuest });
  const programData = isGuest ? guestData : authData;
  const {
    definition,
    config,
    metadata,
    rows,
    results,
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
    exportData,
    importData,
    updateConfigAsync,
  } = programData;
  const setLogsStorageKey = useMemo((): string | null => {
    if (isGuest) return buildSetLogsStorageKey({ userId: null, programId, instanceId });
    // Authenticated but not yet resolved — keep set logs in-memory only so we
    // never persist under the shared 'guest' key or a wrong owner.
    if (!user) return null;
    return buildSetLogsStorageKey({ userId: user.id, programId, instanceId });
  }, [isGuest, user, programId, instanceId]);
  const {
    logSet,
    clearSetLogs,
    getSetLogs,
    isLogging: isSlotLogging,
  } = useSetLogging(markResult, rows, definition, setLogsStorageKey);
  const [webMcpEnabled, setWebMcpEnabled] = useState(false);
  const webMcpSupported = typeof navigator !== 'undefined' && navigator.modelContext !== undefined;

  useWebMcp({
    enabled: webMcpEnabled,
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
  const [editingWeights, setEditingWeights] = useState(false);
  const [navExpanded, setNavExpanded] = useState(false);
  /** Active rest between sets — null when no countdown is running. `id` forces remount. */
  const [rest, setRest] = useState<{ readonly seconds: number; readonly id: number } | null>(null);
  const workoutsPerWeek = definition?.workoutsPerWeek ?? 4;
  const totalWorkouts = definition?.totalWorkouts ?? 0;
  const { completedCount, firstPendingIdx } = useMemo(() => {
    let completed = 0;
    let firstPending = -1;
    for (const row of rows) {
      const allDone = row.slots.every((s) => s.result !== undefined);
      if (allDone) {
        completed += 1;
      } else if (firstPending < 0) {
        firstPending = row.index;
      }
    }
    return { completedCount: completed, firstPendingIdx: firstPending };
  }, [rows]);

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

  useWakeLock(isViewActive && config !== null);

  const handleSetTap = (
    workoutIndex: number,
    slotId: string,
    setIndex: number,
    reps: number,
    weight?: number,
    rpe?: number
  ): void => {
    const row = rows[workoutIndex];
    const slot = row?.slots.find((s) => s.slotId === slotId);
    // Capture pre-update length — logSet is async state, so post-call getSetLogs is stale.
    const beforeCount = getSetLogs(workoutIndex, slotId)?.length ?? 0;
    logSet(workoutIndex, slotId, setIndex, reps, weight, rpe);
    const afterCount = Math.max(beforeCount, setIndex + 1);
    // Match the detailed table row count (includes warm-ups on prescription ladders).
    const totalSets = slot !== undefined ? plannedConfirmableSets(slot) : 0;
    // Rest between sets only — the last set closes the lift (auto-marks result).
    if (slot !== undefined && afterCount < totalSets) {
      setRest({ seconds: restSecondsForRole(slot.role), id: Date.now() });
    } else {
      setRest(null);
    }
  };

  const dismissRest = (): void => {
    setRest(null);
  };

  const firstPendingSlot = useMemo(() => {
    if (firstPendingIdx < 0) return null;
    const row = rows[firstPendingIdx];
    if (!row) return null;
    const slot = row.slots.find((s) => s.result === undefined);
    return slot ?? null;
  }, [rows, firstPendingIdx]);

  useKeyboardShortcuts({
    isActive: isViewActive && config !== null,
    onSuccess: () => {
      // Detailed / set-first mode: S/F would bypass per-set confirm — ignore.
      if (dayNav.viewMode === 'detailed') return;
      if (firstPendingSlot !== null) {
        handleMarkResult(firstPendingIdx, firstPendingSlot.slotId, 'success');
      }
    },
    onFail: () => {
      if (dayNav.viewMode === 'detailed') return;
      if (firstPendingSlot !== null) {
        handleMarkResult(firstPendingIdx, firstPendingSlot.slotId, 'fail');
      }
    },
    onUndo: () => {
      if (undoHistory.length > 0) undoLast();
    },
    onPrevDay: dayNav.handlePrevDay,
    onNextDay: dayNav.handleNextDay,
    onSkipRest: dismissRest,
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

  const handleImportBackup = async (file: File): Promise<void> => {
    if (file.size > MAX_BACKUP_FILE_BYTES) {
      toast({ message: t('tracker.errors.program_import_too_large') });
      return;
    }
    try {
      const imported = await importData(await file.text());
      if (imported) toast({ message: t('tracker.backup_imported') });
    } catch {
      toast({ message: t('tracker.errors.program_import_failed') });
    }
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

  const doneSlots = selectedWorkout
    ? selectedWorkout.slots.filter((slot) => slot.result !== undefined).length
    : 0;

  return (
    <>
      {config && rows.length > 0 && (
        <div className="sticky top-0 z-50">
          <SessionChrome
            definition={definition}
            config={config}
            dayIndex={dayNav.selectedDayIndex}
            totalDays={totalWorkouts}
            dayName={selectedWorkout?.dayName ?? ''}
            isCurrentDay={dayNav.selectedDayIndex === firstPendingIdx}
            doneSlots={doneSlots}
            totalSlots={selectedWorkout?.slots.length ?? 0}
            completedDays={completedCount}
            navExpanded={navExpanded}
            onToggleNav={() => setNavExpanded((x) => !x)}
            onEditWeights={() => setEditingWeights(true)}
            isFinishing={isFinishing}
            onFinish={handleFinishProgram}
            onReset={handleResetAll}
            onExportCsv={handleExportCsv}
            canUseBackup={!isGuest}
            onExportBackup={exportData}
            onImportBackup={handleImportBackup}
            webMcpSupported={webMcpSupported}
            webMcpEnabled={webMcpEnabled}
            onEnableWebMcp={() => setWebMcpEnabled(true)}
            onDisableWebMcp={() => setWebMcpEnabled(false)}
          />
        </div>
      )}

      <div className="max-w-[1300px] mx-auto px-3 sm:px-5 pb-24">
        {config && rows.length > 0 ? (
          editingWeights && (
            <SetupForm
              definition={definition}
              initialConfig={config}
              isGenerating={isGenerating}
              onGenerate={generateProgram}
              onUpdateConfig={(cfg) => {
                updateConfig(cfg);
                setEditingWeights(false);
              }}
              statusNote={jawStatusNote}
              activeGroup={jawContext?.group}
              defaultExpanded
              onClose={() => setEditingWeights(false)}
            />
          )
        ) : (
          <SetupForm
            definition={definition}
            initialConfig={config}
            isGenerating={isGenerating}
            onGenerate={generateProgram}
            onUpdateConfig={updateConfig}
            statusNote={jawStatusNote}
            activeGroup={jawContext?.group}
          />
        )}

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
          <ProgramTabContent
            definition={definition}
            config={config}
            results={results}
            isGuest={isGuest}
            rows={rows}
            selectedWorkout={selectedWorkout}
            selectedDayIndex={dayNav.selectedDayIndex}
            currentDayIndex={firstPendingIdx}
            totalWorkouts={totalWorkouts}
            isDayComplete={isDayComplete}
            viewMode={dayNav.viewMode}
            workoutsPerWeek={workoutsPerWeek}
            resultTimestamps={resultTimestamps}
            navExpanded={navExpanded}
            rest={rest}
            onSkipRest={dismissRest}
            onCloseNav={() => setNavExpanded(false)}
            onPrevDay={dayNav.handlePrevDay}
            onNextDay={dayNav.handleNextDay}
            onGoToCurrent={dayNav.handleGoToCurrent}
            onSelectDay={dayNav.handleSelectDay}
            onToggleView={dayNav.handleToggleView}
            onGoToProfile={onGoToProfile}
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

      {/* The compact session hosts rest inside the current-lift card; the
          detailed table has no hero, so it keeps the floating bar. */}
      {rest !== null && dayNav.viewMode === 'detailed' ? (
        <RestTimer
          key={rest.id}
          seconds={rest.seconds}
          onSkip={dismissRest}
          onComplete={dismissRest}
        />
      ) : null}

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
