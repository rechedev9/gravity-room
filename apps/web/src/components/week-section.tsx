import { useState, useRef, useEffect } from 'react';
import { WorkoutRow } from './workout-row';
import { WorkoutRowCard } from './workout-row-card';
import type { WorkoutRow as WorkoutRowType, Tier, ResultValue } from '@gzclp/shared/types';

interface WeekSectionProps {
  week: number;
  rows: WorkoutRowType[];
  firstPendingIdx: number;
  forceExpanded?: boolean;
  onMark: (index: number, tier: Tier, value: ResultValue) => void;
  onSetAmrapReps: (index: number, field: 't1Reps' | 't3Reps', reps: number | undefined) => void;
  onSetRpe?: (index: number, rpe: number | undefined) => void;
  onUndo: (index: number, tier: Tier) => void;
}

function LazyContent({
  children,
  forceVisible,
}: {
  children: React.ReactNode;
  forceVisible: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(forceVisible);

  useEffect(() => {
    if (forceVisible || visible) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [forceVisible, visible]);

  if (!visible) {
    return <div ref={ref} className="h-[180px]" />;
  }

  return <>{children}</>;
}

export function WeekSection({
  week,
  rows,
  firstPendingIdx,
  forceExpanded,
  onMark,
  onSetAmrapReps,
  onSetRpe,
  onUndo,
}: WeekSectionProps) {
  const isDeload = week % 4 === 0;
  const weekDone = rows.every((r) => r.result.t1 && r.result.t2 && r.result.t3);

  const startWo = rows[0].index + 1;
  const endWo = rows[rows.length - 1].index + 1;

  // Force-render current week and neighbors immediately; or when explicitly forced
  const currentWeek = firstPendingIdx >= 0 ? Math.floor(firstPendingIdx / 3) + 1 : 1;
  const forceVisible = forceExpanded === true || Math.abs(week - currentWeek) <= 1;

  // Only expand current week and its neighbors; all others start collapsed
  const [collapsed, setCollapsed] = useState(!forceVisible);

  return (
    <div className="mb-8 break-inside-avoid">
      <button
        type="button"
        className={`w-full bg-transparent border-l-4 border-l-[var(--fill-progress)] pl-4 text-[var(--text-header)] px-5 py-3.5 flex justify-between items-center select-none border-none ${forceExpanded ? 'cursor-default' : 'cursor-pointer hover:opacity-90'}`}
        aria-expanded={!collapsed}
        onClick={forceExpanded ? undefined : () => setCollapsed(!collapsed)}
      >
        <span
          className="font-display flex items-center gap-2.5"
          style={{ fontSize: '20px', letterSpacing: '0.05em' }}
        >
          Semana {week}
          {isDeload && (
            <span className="inline-block week-badge bg-[var(--text-header)] text-[var(--bg-header)] px-2.5 py-0.5">
              DESCARGA SI ES NECESARIO
            </span>
          )}
          {weekDone && (
            <span className="inline-block week-badge bg-[var(--text-header)] text-[var(--bg-header)] px-2.5 py-0.5">
              LISTO ✓
            </span>
          )}
        </span>
        <span
          className="font-mono opacity-50 tabular-nums"
          style={{ fontSize: '12px', letterSpacing: '0.1em' }}
        >
          {startWo}–{endWo}
        </span>
      </button>

      {!collapsed && (
        <LazyContent forceVisible={forceVisible}>
          {/* Desktop table */}
          <div className="overflow-x-auto hidden lg:block">
            <table
              aria-label="Entrenamientos de la semana"
              className="w-full border-collapse bg-[var(--bg-card)] border border-[var(--border-color)] min-w-[700px]"
            >
              <thead>
                <tr>
                  <th
                    scope="col"
                    rowSpan={2}
                    className="bg-[var(--bg-th)] border border-[var(--border-color)] px-2 py-2.5 text-center font-bold text-xs uppercase tracking-wide text-[var(--text-label)] w-[4%]"
                  >
                    #
                  </th>
                  <th
                    scope="col"
                    rowSpan={2}
                    className="bg-[var(--bg-th)] border border-[var(--border-color)] px-2 py-2.5 text-center font-bold text-xs uppercase tracking-wide text-[var(--text-label)] w-[5%]"
                  >
                    Día
                  </th>
                  <th
                    scope="col"
                    colSpan={4}
                    className="bg-[var(--bg-th)] border border-[var(--border-color)] px-2 py-2.5 text-center font-bold text-xs uppercase tracking-wide text-[var(--text-label)] w-[33%]"
                  >
                    T1 — Levantamiento Principal{' '}
                    <span className="font-normal normal-case">(último set = AMRAP)</span>
                  </th>
                  <th
                    scope="col"
                    colSpan={4}
                    className="bg-[var(--bg-th)] border border-[var(--border-color)] px-2 py-2.5 text-center font-bold text-xs uppercase tracking-wide text-[var(--text-label)] w-[33%]"
                  >
                    T2 — Secundario
                  </th>
                  <th
                    scope="col"
                    colSpan={3}
                    className="bg-[var(--bg-th)] border border-[var(--border-color)] px-2 py-2.5 text-center font-bold text-xs uppercase tracking-wide text-[var(--text-label)] w-[25%]"
                  >
                    T3 — Accesorio{' '}
                    <span className="font-normal normal-case">(último set = AMRAP)</span>
                  </th>
                </tr>
                <tr>
                  {[
                    'Ejercicio',
                    'kg',
                    'Esquema',
                    'Resultado',
                    'Ejercicio',
                    'kg',
                    'Esquema',
                    'Resultado',
                    'Ejercicio',
                    'kg',
                    'Resultado',
                  ].map((h, i) => (
                    <th
                      key={i}
                      scope="col"
                      className="font-mono bg-[var(--bg-th)] border border-[var(--border-color)] px-2 py-2.5 text-center font-bold text-xs uppercase tracking-widest text-[var(--text-label)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <WorkoutRow
                    key={row.index}
                    row={row}
                    isCurrent={row.index === firstPendingIdx}
                    onMark={onMark}
                    onSetAmrapReps={onSetAmrapReps}
                    onSetRpe={onSetRpe}
                    onUndo={onUndo}
                  />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="lg:hidden">
            {rows.map((row) => (
              <WorkoutRowCard
                key={row.index}
                row={row}
                isCurrent={row.index === firstPendingIdx}
                onMark={onMark}
                onSetAmrapReps={onSetAmrapReps}
                onSetRpe={onSetRpe}
                onUndo={onUndo}
              />
            ))}
          </div>
        </LazyContent>
      )}
    </div>
  );
}
