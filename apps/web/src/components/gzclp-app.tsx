import { useState, useMemo, useCallback, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Tier, ResultValue } from '@gzclp/shared/types';
import { useProgram } from '@/hooks/use-program';
import { useAuth } from '@/contexts/auth-context';
import { computeProgram } from '@gzclp/shared/engine';
import { TOTAL_WORKOUTS, NAMES } from '@gzclp/shared/program';
import { useToast } from '@/contexts/toast-context';
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
  const {
    startWeights,
    results,
    undoHistory,
    generateProgram,
    updateWeights,
    markResult,
    setAmrapReps,
    undoSpecific,
    undoLast,
    resetAll,
  } = useProgram(instanceId);

  const { signOut } = useAuth();
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

  const handleMarkResult = useCallback(
    (index: number, tier: Tier, value: ResultValue): void => {
      markResult(index, tier, value);
      const row = rows[index];
      if (!row) return;
      const exerciseKey =
        tier === 't1' ? row.t1Exercise : tier === 't2' ? row.t2Exercise : row.t3Exercise;
      const tierLabel = tier.toUpperCase();
      const resultLabel = value === 'success' ? 'Success' : 'Fail';
      toast({
        message: `#${index + 1}: ${NAMES[exerciseKey]} ${tierLabel} — ${resultLabel}`,
        action: {
          label: 'Undo',
          onClick: () => undoSpecific(index, tier),
        },
      });
    },
    [markResult, rows, toast, undoSpecific]
  );

  const jumpToCurrent = useCallback(() => {
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
  }, []);

  const handleSignOut = useCallback(async (): Promise<void> => {
    await signOut();
    queryClient.clear();
  }, [signOut, queryClient]);

  return (
    <>
      <div className="sticky top-0 z-50">
        <AppHeader
          backLabel="Programs"
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
          onGenerate={generateProgram}
          onUpdateWeights={updateWeights}
        />

        {startWeights && (
          <>
            {/* Tabs */}
            <div className="flex gap-0 mb-6 border-b-2 border-[var(--border-color)]">
              <TabButton active={activeTab === 'program'} onClick={() => setActiveTab('program')}>
                Program
              </TabButton>
              <TabButton active={activeTab === 'stats'} onClick={() => setActiveTab('stats')}>
                Stats &amp; Charts
              </TabButton>
            </div>

            {activeTab === 'program' && (
              <>
                {/* Info toggle */}
                <details className="bg-[var(--bg-card)] border border-[var(--border-color)] mb-6 overflow-hidden">
                  <summary className="font-mono px-5 py-3.5 font-bold cursor-pointer select-none flex justify-between items-center [&::marker]:hidden list-none text-[11px] tracking-widest uppercase">
                    Progression Rules &amp; How to Use
                    <span className="transition-transform duration-200 [[open]>&]:rotate-90">
                      &#9656;
                    </span>
                  </summary>
                  <div className="px-5 pb-5 border-t border-[var(--border-light)]">
                    <ul className="mt-3 ml-5 text-[13px] leading-8 text-[var(--text-info)] list-disc">
                      <li>
                        <strong>&#10003; Success</strong> — Adds weight next session (+2.5 kg
                        Bench/OHP, +5 kg Squat/DL)
                      </li>
                      <li>
                        <strong>&#10007; Fail</strong> — Keeps weight, advances stage: 5&times;3 →
                        6&times;2 → 10&times;1
                      </li>
                      <li>
                        <strong>T1 Stage 3 Fail</strong> — Weight drops 10%, restarts at 5&times;3
                      </li>
                      <li>
                        <strong>T2 Stage 3 Fail</strong> — Adds 15 kg to original weight, restarts
                        at 3&times;10
                      </li>
                      <li>
                        <strong>T3 Success</strong> — Adds 2.5 kg when AMRAP set reaches 25+ reps.
                        Fail = same weight
                      </li>
                      <li>
                        <strong>AMRAP</strong> — Last set of T1 and T3 = as many reps as possible
                        (stop 1-2 before failure)
                      </li>
                      <li>
                        <strong>Stage Colors</strong> — S1 (black) = normal, S2 (orange) = caution,
                        S3 (red) = reset next fail
                      </li>
                      <li>
                        <strong>Undo</strong> — Click any badge to undo, or use the Undo button in
                        the toolbar
                      </li>
                      <li>
                        <strong>Yellow rows</strong> — Recalculated because of a previous Fail
                      </li>
                    </ul>
                  </div>
                </details>

                {/* Stage Legend */}
                <div className="flex items-center gap-4 mb-5 text-[12px] font-bold">
                  <span className="text-[var(--text-muted)] mr-1">Stages:</span>
                  <span className="inline-flex items-center gap-1.5">
                    <StageTag stage={0} size="md" /> Normal
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <StageTag stage={1} size="md" /> Caution
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <StageTag stage={2} size="md" /> Reset
                  </span>
                </div>

                {weeks.map(({ week, rows: weekRows }) => (
                  <WeekSection
                    key={week}
                    week={week}
                    rows={weekRows}
                    firstPendingIdx={firstPendingIdx}
                    onMark={handleMarkResult}
                    onSetAmrapReps={setAmrapReps}
                    onUndo={undoSpecific}
                  />
                ))}
              </>
            )}

            {activeTab === 'stats' && (
              <ErrorBoundary
                fallback={({ reset }) => (
                  <div className="text-center py-16">
                    <p className="text-[var(--text-muted)] mb-4">Stats could not be loaded.</p>
                    <button
                      onClick={reset}
                      className="px-5 py-2 bg-[var(--fill-progress)] text-white font-bold cursor-pointer"
                    >
                      Retry
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
