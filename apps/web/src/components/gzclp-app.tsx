import { lazy, Suspense, useState, useTransition, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Tier, ResultValue, WorkoutRow as WorkoutRowType } from '@gzclp/shared/types';
import { computeProgram } from '@gzclp/shared/engine';
import { useProgram } from '@/hooks/use-program';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { detectT1PersonalRecord } from '@/lib/pr-detection';
import { queryKeys } from '@/lib/query-keys';
import { fetchCatalogDetail } from '@/lib/api-functions';
import { AppHeader } from './app-header';
import { ConfirmDialog } from './confirm-dialog';
import { DayNavigator } from './day-navigator';
import type { DayTab } from './day-navigator';
import { DayView } from './day-view';
import type { DayViewSlot } from './day-view';
import { ErrorBoundary } from './error-boundary';
import { ToastContainer } from './toast';
import { SetupForm } from './setup-form';
import { Toolbar } from './toolbar';
import { WeekNavigator } from './week-navigator';
import { StatsSkeleton } from './stats-skeleton';
import { StageTag } from './stage-tag';
import { TabButton } from './tab-button';

const StatsPanel = lazy(() => import('./stats-panel'));
const preloadStatsPanel = (): void => {
  void import('./stats-panel');
};

function gzclpRowToSlots(
  row: WorkoutRowType,
  names: Readonly<Record<string, string>>
): readonly DayViewSlot[] {
  return [
    {
      key: 't1',
      exerciseName: names[row.t1Exercise] ?? row.t1Exercise,
      tierLabel: 'T1',
      role: 'primary',
      weight: row.t1Weight,
      scheme: `${row.t1Sets}\u00d7${row.t1Reps}`,
      stage: row.t1Stage,
      showStage: true,
      isAmrap: true,
      result: row.result.t1,
      amrapReps: row.result.t1Reps,
      rpe: row.result.rpe,
      showRpe: true,
      isChanged: row.isChanged,
    },
    {
      key: 't2',
      exerciseName: names[row.t2Exercise] ?? row.t2Exercise,
      tierLabel: 'T2',
      role: 'secondary',
      weight: row.t2Weight,
      scheme: `${row.t2Sets}\u00d7${row.t2Reps}`,
      stage: row.t2Stage,
      showStage: true,
      isAmrap: false,
      result: row.result.t2,
      amrapReps: undefined,
      rpe: undefined,
      showRpe: false,
      isChanged: row.isChanged,
    },
    {
      key: 't3',
      exerciseName: names[row.t3Exercise] ?? row.t3Exercise,
      tierLabel: 'T3',
      role: 'accessory',
      weight: row.t3Weight,
      scheme: '3\u00d715',
      stage: 0,
      showStage: false,
      isAmrap: true,
      result: row.result.t3,
      amrapReps: row.result.t3Reps,
      rpe: row.result.t3Rpe,
      showRpe: true,
      isChanged: row.isChanged,
    },
  ];
}

interface GZCLPAppProps {
  readonly instanceId?: string;
  readonly onBackToDashboard?: () => void;
  readonly onGoToProfile?: () => void;
}

export function GZCLPApp({
  instanceId,
  onBackToDashboard,
  onGoToProfile,
}: GZCLPAppProps): React.ReactNode {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  // Fetch the GZCLP definition from the catalog API
  const catalogQuery = useQuery({
    queryKey: queryKeys.catalog.detail('gzclp'),
    queryFn: () => fetchCatalogDetail('gzclp'),
    staleTime: 5 * 60 * 1000,
  });

  const definition = catalogQuery.data;

  // Derive NAMES and TOTAL_WORKOUTS from the definition
  const names: Readonly<Record<string, string>> = useMemo(() => {
    if (!definition) return {};
    const map: Record<string, string> = {};
    for (const [id, ex] of Object.entries(definition.exercises)) {
      map[id] = ex.name;
    }
    return map;
  }, [definition]);

  const totalWorkouts = definition?.totalWorkouts ?? 90;

  useEffect(() => {
    if (!authLoading && user === null) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, navigate]);

  const {
    startWeights,
    results,
    undoHistory,
    isGenerating,
    generateProgram,
    updateWeights,
    markResult,
    setAmrapReps,
    setRpe,
    undoSpecific,
    undoLast,
    finishProgram,
    resetAll,
  } = useProgram(instanceId);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'program' | 'stats'>('program');
  const [isPending, startTransition] = useTransition();
  const [rpeReminder, setRpeReminder] = useState<{
    index: number;
    tier: Tier;
    value: ResultValue;
  } | null>(null);

  const rows = startWeights ? computeProgram(startWeights, results) : [];

  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  // useWebMcp removed — hook is now wired into GenericProgramApp

  const completedCount = rows.filter((r) => r.result.t1 && r.result.t2 && r.result.t3).length;

  const firstPendingIdx = (() => {
    const pending = rows.find((r) => !r.result.t1 || !r.result.t2 || !r.result.t3);
    return pending ? pending.index : -1;
  })();

  const weeks = Array.from({ length: Math.ceil(rows.length / 3) }, (_, i) => ({
    week: i + 1,
    rows: rows.slice(i * 3, i * 3 + 3),
  }));

  const currentWeekNumber =
    firstPendingIdx >= 0 ? Math.floor(firstPendingIdx / 3) + 1 : Math.max(weeks.length, 1);

  const [selectedWeek, setSelectedWeek] = useState<number>(1);

  // Ref holds the latest currentWeekNumber without being a dep of the effect below,
  // so we only jump to the current week when the program is generated/weights updated,
  // not on every result mark.
  const currentWeekNumberRef = useRef(currentWeekNumber);
  currentWeekNumberRef.current = currentWeekNumber;

  useEffect(() => {
    if (currentWeekNumberRef.current > 0) {
      setSelectedWeek(currentWeekNumberRef.current);
    }
  }, [startWeights]);

  const weekDoneCount = (weeks[selectedWeek - 1]?.rows ?? []).filter(
    (r) => r.result.t1 && r.result.t2 && r.result.t3
  ).length;
  const weekTotalCount = weeks[selectedWeek - 1]?.rows.length ?? 3;

  // Day-level navigation within the selected week
  const [selectedDay, setSelectedDay] = useState(0);
  const [prevSelectedWeek, setPrevSelectedWeek] = useState(selectedWeek);

  if (prevSelectedWeek !== selectedWeek) {
    setPrevSelectedWeek(selectedWeek);
    const weekRows = weeks[selectedWeek - 1]?.rows ?? [];
    const pending = weekRows.findIndex((r) => !r.result.t1 || !r.result.t2 || !r.result.t3);
    setSelectedDay(pending >= 0 ? pending : 0);
  }

  const dayTabs: readonly DayTab[] = (() => {
    const weekRows = weeks[selectedWeek - 1]?.rows ?? [];
    return weekRows.map((row) => ({
      label: row.dayName,
      isComplete: Boolean(row.result.t1 && row.result.t2 && row.result.t3),
    }));
  })();

  const currentDayInWeek: number = (() => {
    if (selectedWeek !== currentWeekNumber) return -1;
    const weekRows = weeks[selectedWeek - 1]?.rows ?? [];
    return weekRows.findIndex((r) => !r.result.t1 || !r.result.t2 || !r.result.t3);
  })();

  const selectedRow = weeks[selectedWeek - 1]?.rows[selectedDay];

  // Adapters: DayView uses (index, slotKey: string, ...) but GZCLP uses narrow types
  const handleDayAmrapReps = (
    workoutIndex: number,
    slotKey: string,
    reps: number | undefined
  ): void => {
    const field = slotKey === 't1' ? 't1Reps' : 't3Reps';
    setAmrapReps(workoutIndex, field, reps);
  };

  const handleDayRpe = (workoutIndex: number, slotKey: string, rpe: number | undefined): void => {
    if (slotKey !== 't1' && slotKey !== 't3') return;
    setRpe(workoutIndex, slotKey, rpe);
  };

  const recordAndToast = (index: number, tier: Tier, value: ResultValue): void => {
    markResult(index, tier, value);
    const row = rowsRef.current[index];
    if (!row) return;
    const exerciseByTier: Record<string, string> = {
      t1: row.t1Exercise,
      t2: row.t2Exercise,
      t3: row.t3Exercise,
    };
    const exerciseKey = exerciseByTier[tier] ?? '';
    const isPr = detectT1PersonalRecord(rowsRef.current, index, tier, value);
    if (isPr) {
      toast({
        message: `${names[exerciseKey] ?? exerciseKey} ${row.t1Weight} kg`,
        variant: 'pr',
      });
    } else {
      const tierLabel = tier.toUpperCase();
      const resultLabel = value === 'success' ? 'Éxito' : 'Fallo';
      toast({
        message: `#${index + 1}: ${names[exerciseKey] ?? exerciseKey} ${tierLabel} — ${resultLabel}`,
        action: {
          label: 'Deshacer',
          onClick: () => undoSpecific(index, tier),
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

  const handleMarkResult = (index: number, tier: Tier, value: ResultValue): void => {
    const row = rowsRef.current[index];
    if (!row) {
      recordAndToast(index, tier, value);
      return;
    }

    const otherTiers = (['t1', 't2', 't3'] as const).filter((t) => t !== tier);
    const wouldComplete = otherTiers.every((t) => row.result[t] !== undefined);

    if (wouldComplete && row.result.rpe === undefined) {
      // fix: RPE reminder only when T1 is success (AMRAP/RPE only applies on success)
      const t1IsSuccess = row.result.t1 === 'success' || (tier === 't1' && value === 'success');
      if (t1IsSuccess) {
        setRpeReminder({ index, tier, value });
        return;
      }
    }

    recordAndToast(index, tier, value);
  };

  const handleRpeReminderContinue = (): void => {
    if (!rpeReminder) return;
    // fix: blur active element to clear any residual RPE button focus/hover state
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    recordAndToast(rpeReminder.index, rpeReminder.tier, rpeReminder.value);
    setRpeReminder(null);
  };

  const handleRpeReminderAdd = (): void => {
    if (!rpeReminder) return;
    recordAndToast(rpeReminder.index, rpeReminder.tier, rpeReminder.value);
    scrollToRpeInput(`${rpeReminder.index}-t1`);
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
    const pendingDay = weekRows.findIndex(
      (r: WorkoutRowType) => !r.result.t1 || !r.result.t2 || !r.result.t3
    );
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
    if (activeTab !== 'program' || !startWeights) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') setSelectedWeek((w) => Math.max(1, w - 1));
      else if (e.key === 'ArrowRight') setSelectedWeek((w) => Math.min(weeks.length, w + 1));
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, startWeights, weeks.length]);

  const handleSignOut = async (): Promise<void> => {
    await signOut();
    queryClient.clear();
  };

  if (authLoading || user === null) return null;

  return (
    <>
      <div className="sticky top-0 z-50">
        <AppHeader
          backLabel="Programas"
          onBack={onBackToDashboard}
          onGoToProfile={onGoToProfile}
          onSignOut={() => void handleSignOut()}
        />

        {startWeights && (
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
        <SetupForm
          initialWeights={startWeights}
          isGenerating={isGenerating}
          onGenerate={generateProgram}
          onUpdateWeights={updateWeights}
        />

        {startWeights && (
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
                onMouseEnter={preloadStatsPanel}
                onFocus={preloadStatsPanel}
              >
                Estadísticas
              </TabButton>
            </div>

            {activeTab === 'program' && (
              <>
                {/* Info toggle */}
                <details className="group bg-[var(--bg-card)] border border-[var(--border-color)] mb-4 sm:mb-8 overflow-hidden">
                  <summary className="font-mono px-5 py-3.5 font-bold cursor-pointer select-none flex justify-between items-center [&::marker]:hidden list-none text-[11px] tracking-widest uppercase">
                    Reglas de Progresión y Cómo Usar
                    <span className="transition-transform duration-200 group-open:rotate-90">
                      &#9656;
                    </span>
                  </summary>
                  <div className="px-5 pb-5 border-t border-[var(--border-light)]">
                    <ul className="mt-3 ml-5 text-[13px] leading-8 text-[var(--text-info)] list-disc">
                      <li>
                        <strong>&#10003; Éxito</strong> — Agrega peso en la próxima sesión (+2.5 kg
                        Press Banca/Press Militar, +5 kg Sentadilla/Peso Muerto)
                      </li>
                      <li>
                        <strong>&#10007; Fallo</strong> — Mantiene peso, avanza de etapa: 5&times;3
                        → 6&times;2 → 10&times;1
                      </li>
                      <li>
                        <strong>T1 Etapa 3 Fallo</strong> — El peso baja 10%, reinicia en 5&times;3
                      </li>
                      <li>
                        <strong>T2 Etapa 3 Fallo</strong> — Agrega 15 kg al peso original, reinicia
                        en 3&times;10
                      </li>
                      <li>
                        <strong>T3 Éxito</strong> — Agrega 2.5 kg cuando el set AMRAP llega a 25+
                        reps. Fallo = mismo peso
                      </li>
                      <li>
                        <strong>AMRAP</strong> — Último set de T1 y T3 = máximas repeticiones
                        posibles (detente 1-2 antes del fallo)
                      </li>
                      <li>
                        <strong>Colores de Etapa</strong> — E1 (negro) = normal, E2 (naranja) =
                        precaución, E3 (rojo) = reinicio en próximo fallo
                      </li>
                      <li>
                        <strong>Deshacer</strong> — Haz clic en cualquier insignia para deshacer, o
                        usa el botón Deshacer en la barra de herramientas
                      </li>
                      <li>
                        <strong>Filas amarillas</strong> — Recalculadas por un fallo previo
                      </li>
                    </ul>
                    <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[var(--border-light)] text-[12px] font-bold">
                      <span className="text-[var(--text-muted)] mr-1">Etapas:</span>
                      <span className="inline-flex items-center gap-1.5">
                        <StageTag stage={0} size="md" /> Normal
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <StageTag stage={1} size="md" /> Precaución
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <StageTag stage={2} size="md" /> Reinicio
                      </span>
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
                    slots={gzclpRowToSlots(selectedRow, names)}
                    onMark={handleMarkResult}
                    onUndo={undoSpecific}
                    onSetAmrapReps={handleDayAmrapReps}
                    onSetRpe={handleDayRpe}
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
                    <StatsPanel
                      startWeights={startWeights}
                      results={results}
                      definition={definition}
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
        message="No registraste el RPE del ejercicio T1. El RPE es opcional, pero útil para seguir tu esfuerzo percibido."
        confirmLabel="Añadir RPE"
        cancelLabel="Continuar sin RPE"
        onConfirm={handleRpeReminderAdd}
        onCancel={handleRpeReminderContinue}
      />

      <ToastContainer />
    </>
  );
}
