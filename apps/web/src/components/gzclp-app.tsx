import { useState, useMemo, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { Tier, ResultValue } from '@gzclp/shared/types';
import { useProgram } from '@/hooks/use-program';
import { useAuth } from '@/contexts/auth-context';
import { computeProgram } from '@gzclp/shared/engine';
import { TOTAL_WORKOUTS, NAMES } from '@gzclp/shared/program';
import { useToast } from '@/contexts/toast-context';
import { detectT1PersonalRecord } from '@/lib/pr-detection';
import { AppHeader } from './app-header';
import { ToastContainer } from './toast';
import { SetupForm } from './setup-form';
import { Toolbar } from './toolbar';
import { WeekSection } from './week-section';
import { StatsPanel } from './stats-panel';
import { StageTag } from './stage-tag';
import { ErrorBoundary } from './error-boundary';
import { useWebMcp } from '@/hooks/use-webmcp';

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
        aria-label="Semana anterior"
        className="font-mono text-[11px] font-bold tracking-widest uppercase px-4 py-2.5 border-2 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors hover:bg-[var(--bg-hover-row)] hover:text-[var(--text-main)]"
      >
        ← Prev
      </button>

      <div className="flex-1 flex flex-col items-center gap-1">
        <div className="flex items-center gap-2">
          <span className="font-display" style={{ fontSize: '20px', letterSpacing: '0.05em' }}>
            Semana {selectedWeek}
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
            aria-label={`${weekDoneCount} de ${weekTotalCount} entrenamientos completados`}
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
              → Actual
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={selectedWeek >= totalWeeks}
        aria-label="Semana siguiente"
        className="font-mono text-[11px] font-bold tracking-widest uppercase px-4 py-2.5 border-2 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors hover:bg-[var(--bg-hover-row)] hover:text-[var(--text-main)]"
      >
        Next →
      </button>
    </div>
  );
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
    resetAll,
  } = useProgram(instanceId);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'program' | 'stats'>('program');

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

  const handleMarkResult = useCallback(
    (index: number, tier: Tier, value: ResultValue): void => {
      markResult(index, tier, value);
      const row = rows[index];
      if (!row) return;
      const exerciseKey =
        tier === 't1' ? row.t1Exercise : tier === 't2' ? row.t2Exercise : row.t3Exercise;
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
              <TabButton active={activeTab === 'program'} onClick={() => setActiveTab('program')}>
                Programa
              </TabButton>
              <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')}>
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
                <StatsPanel startWeights={startWeights} results={results} />
              </ErrorBoundary>
            )}
          </>
        )}
      </div>

      <ToastContainer />
    </>
  );
}
