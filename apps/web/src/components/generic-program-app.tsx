import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { ResultValue } from '@gzclp/shared/types';
import { useGenericProgram } from '@/hooks/use-generic-program';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { detectGenericPersonalRecord } from '@/lib/pr-detection';
import { AppHeader } from './app-header';
import { ToastContainer } from './toast';
import { GenericSetupForm } from './generic-setup-form';
import { GenericStatsPanel } from './generic-stats-panel';
import { ErrorBoundary } from './error-boundary';
import { Toolbar } from './toolbar';
import { WeekNavigator } from './week-navigator';
import { GenericWeekSection } from './generic-week-section';

function TabButton({
  active,
  onClick,
  children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <button
      onClick={onClick}
      className={`font-mono px-4 sm:px-6 py-3 text-[10px] sm:text-[11px] font-bold cursor-pointer tracking-widest uppercase transition-colors -mb-[2px] ${
        active
          ? 'border-b-2 border-[var(--fill-progress)] text-[var(--text-main)]'
          : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
      }`}
    >
      {children}
    </button>
  );
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
    resetAll,
  } = useGenericProgram(programId, instanceId);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'program' | 'stats'>('program');

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
    if (activeTab !== 'program' || !config) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') setSelectedWeek((w) => Math.max(1, w - 1));
      else if (e.key === 'ArrowRight') setSelectedWeek((w) => Math.min(weeks.length, w + 1));
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, config, weeks.length]);

  const handleSignOut = useCallback(async (): Promise<void> => {
    await signOut();
    queryClient.clear();
  }, [signOut, queryClient]);

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
            onJumpToCurrent={jumpToCurrent}
            onReset={resetAll}
          />
        )}
      </div>

      <div className="max-w-[1300px] mx-auto px-5 pb-20">
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
            <div className="flex gap-0 mb-6 border-b-2 border-[var(--border-color)]">
              <TabButton active={activeTab === 'program'} onClick={() => setActiveTab('program')}>
                Programa
              </TabButton>
              <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')}>
                Estadísticas
              </TabButton>
            </div>

            {activeTab === 'program' && (
              <>
                {/* Program info */}
                <details className="bg-[var(--bg-card)] border border-[var(--border-color)] mb-6 overflow-hidden">
                  <summary className="font-mono px-5 py-3.5 font-bold cursor-pointer select-none flex justify-between items-center [&::marker]:hidden list-none text-[11px] tracking-widest uppercase">
                    Acerca de {definition.name}
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
                {weeks[selectedWeek - 1] && (
                  <GenericWeekSection
                    key={selectedWeek}
                    week={selectedWeek}
                    rows={weeks[selectedWeek - 1].rows}
                    firstPendingIdx={firstPendingIdx}
                    forceExpanded
                    onMark={handleMarkResult}
                    onSetAmrapReps={setAmrapReps}
                    onSetRpe={setRpe}
                    onUndo={undoSpecific}
                  />
                )}
              </>
            )}

            {activeTab === 'stats' && (
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
                <GenericStatsPanel definition={definition} rows={rows} />
              </ErrorBoundary>
            )}
          </>
        )}
      </div>

      <ToastContainer />
    </>
  );
}
