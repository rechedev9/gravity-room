import {
  lazy,
  Suspense,
  useState,
  useTransition,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Tier, ResultValue } from '@gzclp/shared/types';
import { computeProgram } from '@gzclp/shared/engine';
import { TOTAL_WORKOUTS, NAMES } from '@gzclp/shared/program';
import { useProgram } from '@/hooks/use-program';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { useWebMcp } from '@/hooks/use-webmcp';
import { detectT1PersonalRecord } from '@/lib/pr-detection';
import { AppHeader } from './app-header';
import { ConfirmDialog } from './confirm-dialog';
import { ErrorBoundary } from './error-boundary';
import { ToastContainer } from './toast';
import { SetupForm } from './setup-form';
import { Toolbar } from './toolbar';
import { WeekNavigator } from './week-navigator';
import { WeekSection } from './week-section';
import { StatsSkeleton } from './stats-skeleton';
import { StageTag } from './stage-tag';
import { TabButton } from './tab-button';

const StatsPanel = lazy(() => import('./stats-panel'));
const preloadStatsPanel = (): void => {
  void import('./stats-panel');
};

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
  const { user, loading: authLoading, isGuest, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && user === null && !isGuest) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, isGuest, navigate]);

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

  const rows = useMemo(
    () => (startWeights ? computeProgram(startWeights, results) : []),
    [startWeights, results]
  );

  useWebMcp({ startWeights, results, rows, generateProgram, markResult, setAmrapReps, undoLast });

  const completedCount = useMemo(
    () => rows.filter((r) => r.result.t1 && r.result.t2 && r.result.t3).length,
    [rows]
  );

  const firstPendingIdx = useMemo(() => {
    const pending = rows.find((r) => !r.result.t1 || !r.result.t2 || !r.result.t3);
    return pending ? pending.index : -1;
  }, [rows]);

  const weeks = useMemo(
    () =>
      Array.from({ length: Math.ceil(rows.length / 3) }, (_, i) => ({
        week: i + 1,
        rows: rows.slice(i * 3, i * 3 + 3),
      })),
    [rows]
  );

  const currentWeekNumber = useMemo(
    () => (firstPendingIdx >= 0 ? Math.floor(firstPendingIdx / 3) + 1 : Math.max(weeks.length, 1)),
    [firstPendingIdx, weeks.length]
  );

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

  const weekDoneCount = useMemo(
    () =>
      (weeks[selectedWeek - 1]?.rows ?? []).filter((r) => r.result.t1 && r.result.t2 && r.result.t3)
        .length,
    [weeks, selectedWeek]
  );
  const weekTotalCount = weeks[selectedWeek - 1]?.rows.length ?? 3;

  const recordAndToast = useCallback(
    (index: number, tier: Tier, value: ResultValue): void => {
      markResult(index, tier, value);
      const row = rows[index];
      if (!row) return;
      const exerciseByTier = { t1: row.t1Exercise, t2: row.t2Exercise, t3: row.t3Exercise };
      const exerciseKey = exerciseByTier[tier];
      const isPr = detectT1PersonalRecord(rows, index, tier, value);
      if (isPr) {
        toast({
          message: `${NAMES[exerciseKey]} ${row.t1Weight} kg`,
          variant: 'pr',
        });
      } else {
        const tierLabel = tier.toUpperCase();
        const resultLabel = value === 'success' ? 'Éxito' : 'Fallo';
        toast({
          message: `#${index + 1}: ${NAMES[exerciseKey]} ${tierLabel} — ${resultLabel}`,
          action: {
            label: 'Deshacer',
            onClick: () => undoSpecific(index, tier),
          },
        });
      }
    },
    [markResult, rows, toast, undoSpecific]
  );

  const scrollToRpeInput = useCallback((index: number): void => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = document.querySelector(`[data-rpe-input="${index}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    });
  }, []);

  const handleMarkResult = useCallback(
    (index: number, tier: Tier, value: ResultValue): void => {
      const row = rows[index];
      if (!row) {
        recordAndToast(index, tier, value);
        return;
      }

      const otherTiers = (['t1', 't2', 't3'] as const).filter((t) => t !== tier);
      const wouldComplete = otherTiers.every((t) => row.result[t] !== undefined);

      if (wouldComplete && row.result.rpe === undefined) {
        // T1 already has a result → RPE input is visible but empty
        // OR T1 is the tier being marked → RPE input will appear after recording
        const t1HasOrWillHaveResult = row.result.t1 !== undefined || tier === 't1';
        if (t1HasOrWillHaveResult) {
          setRpeReminder({ index, tier, value });
          return;
        }
      }

      recordAndToast(index, tier, value);
    },
    [rows, recordAndToast]
  );

  const handleRpeReminderContinue = useCallback((): void => {
    if (!rpeReminder) return;
    recordAndToast(rpeReminder.index, rpeReminder.tier, rpeReminder.value);
    setRpeReminder(null);
  }, [rpeReminder, recordAndToast]);

  const handleRpeReminderAdd = useCallback((): void => {
    if (!rpeReminder) return;
    recordAndToast(rpeReminder.index, rpeReminder.tier, rpeReminder.value);
    scrollToRpeInput(rpeReminder.index);
    setRpeReminder(null);
  }, [rpeReminder, recordAndToast, scrollToRpeInput]);

  const jumpToCurrent = useCallback(() => {
    setSelectedWeek(currentWeekNumber);
    // Double rAF ensures the new week's DOM is fully painted before scrolling
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
    if (activeTab !== 'program' || !startWeights) return;
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft') setSelectedWeek((w) => Math.max(1, w - 1));
      else if (e.key === 'ArrowRight') setSelectedWeek((w) => Math.min(weeks.length, w + 1));
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, startWeights, weeks.length]);

  const handleSignOut = useCallback(async (): Promise<void> => {
    await signOut();
    queryClient.clear();
  }, [signOut, queryClient]);

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
            totalWorkouts={TOTAL_WORKOUTS}
            undoCount={undoHistory.length}
            onUndo={undoLast}
            onJumpToCurrent={jumpToCurrent}
            onReset={resetAll}
          />
        )}
      </div>

      <div className="max-w-[1300px] mx-auto px-5 pb-20">
        <SetupForm
          initialWeights={startWeights}
          isGenerating={isGenerating}
          onGenerate={generateProgram}
          onUpdateWeights={updateWeights}
        />

        {startWeights && (
          <>
            {/* Tabs */}
            <div className="flex gap-0 mb-6 border-b-2 border-[var(--border-color)]">
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
                <details className="bg-[var(--bg-card)] border border-[var(--border-color)] mb-6 overflow-hidden">
                  <summary className="font-mono px-5 py-3.5 font-bold cursor-pointer select-none flex justify-between items-center [&::marker]:hidden list-none text-[11px] tracking-widest uppercase">
                    Reglas de Progresión y Cómo Usar
                    <span className="transition-transform duration-200 [[open]>&]:rotate-90">
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
                {weeks[selectedWeek - 1] && (
                  <WeekSection
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
                    <StatsPanel startWeights={startWeights} results={results} />
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
