'use client';

import { useState, useMemo, useCallback } from 'react';
import { useProgram } from '@/hooks/use-program';
import { computeProgram } from '@/lib/engine';
import { TOTAL_WORKOUTS } from '@/lib/program';
import { SetupForm } from './setup-form';
import { Toolbar } from './toolbar';
import { WeekSection } from './week-section';
import { StatsPanel } from './stats-panel';
import { StageTag } from './stage-tag';

export function GZCLPApp() {
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
    exportData,
    importData,
  } = useProgram();

  const [activeTab, setActiveTab] = useState<'program' | 'stats'>('program');

  const rows = useMemo(
    () => (startWeights ? computeProgram(startWeights, results) : []),
    [startWeights, results]
  );

  const completedCount = useMemo(
    () => rows.filter((r) => r.result.t1 && r.result.t2 && r.result.t3).length,
    [rows]
  );

  const firstPendingIdx = useMemo(() => {
    const pending = rows.find((r) => !r.result.t1 || !r.result.t2 || !r.result.t3);
    return pending ? pending.index : -1;
  }, [rows]);

  // Group rows by week (3 workouts per week)
  const weeks = useMemo(() => {
    const result: { week: number; rows: typeof rows }[] = [];
    for (let i = 0; i < rows.length; i += 3) {
      result.push({
        week: Math.floor(i / 3) + 1,
        rows: rows.slice(i, i + 3),
      });
    }
    return result;
  }, [rows]);

  const jumpToCurrent = useCallback(() => {
    const el = document.querySelector('[data-current-row]');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight-current');
      const handleEnd = () => {
        el.classList.remove('highlight-current');
        el.removeEventListener('animationend', handleEnd);
      };
      el.addEventListener('animationend', handleEnd);
    }
  }, []);

  return (
    <>
      <header className="text-center py-6 sm:py-10 px-5 bg-[var(--bg-header)] text-[var(--text-header)] mb-7">
        <h1 className="text-[22px] sm:text-[28px] font-extrabold tracking-tight mb-1.5">
          RSN 30-WEEK-PROGRAM
        </h1>
        <p className="text-[13px] opacity-70">
          App made by RSN based on Cody Lefever program GZCLP
        </p>
      </header>

      {startWeights && (
        <Toolbar
          completedCount={completedCount}
          totalWorkouts={TOTAL_WORKOUTS}
          undoCount={undoHistory.length}
          onUndo={undoLast}
          onExport={exportData}
          onImport={importData}
          onJumpToCurrent={jumpToCurrent}
          onReset={resetAll}
        />
      )}

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
              <button
                onClick={() => setActiveTab('program')}
                className={`px-3 sm:px-6 py-3 text-xs sm:text-sm font-bold cursor-pointer transition-colors -mb-[2px] ${
                  activeTab === 'program'
                    ? 'border-b-2 border-[var(--fill-progress)] text-[var(--text-main)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                Program
              </button>
              <button
                onClick={() => setActiveTab('stats')}
                className={`px-3 sm:px-6 py-3 text-xs sm:text-sm font-bold cursor-pointer transition-colors -mb-[2px] ${
                  activeTab === 'stats'
                    ? 'border-b-2 border-[var(--fill-progress)] text-[var(--text-main)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                Stats &amp; Charts
              </button>
            </div>

            {activeTab === 'program' && (
              <>
                {/* Info toggle */}
                <details className="bg-[var(--bg-card)] border border-[var(--border-color)] mb-6 overflow-hidden">
                  <summary className="px-5 py-3.5 font-bold cursor-pointer select-none flex justify-between items-center [&::marker]:hidden list-none">
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
                    onMark={markResult}
                    onSetAmrapReps={setAmrapReps}
                    onUndo={undoSpecific}
                  />
                ))}
              </>
            )}

            {activeTab === 'stats' && <StatsPanel startWeights={startWeights} results={results} />}
          </>
        )}
      </div>
    </>
  );
}
