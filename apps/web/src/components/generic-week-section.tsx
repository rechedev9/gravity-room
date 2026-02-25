import { useState, useRef, useEffect, useMemo } from 'react';
import type { GenericWorkoutRow, ResultValue } from '@gzclp/shared/types';
import { GenericWorkoutCard } from './generic-workout-card';
import { GenericWorkoutRow as GenericWorkoutRowComponent } from './generic-workout-row';

interface GenericWeekSectionProps {
  readonly week: number;
  readonly rows: readonly GenericWorkoutRow[];
  readonly firstPendingIdx: number;
  readonly forceExpanded?: boolean;
  readonly onMark: (workoutIndex: number, slotId: string, value: ResultValue) => void;
  readonly onSetAmrapReps: (workoutIndex: number, slotId: string, reps: number | undefined) => void;
  readonly onSetRpe?: (workoutIndex: number, slotId: string, rpe: number | undefined) => void;
  readonly onUndo: (workoutIndex: number, slotId: string) => void;
}

function LazyContent({
  children,
  forceVisible,
}: {
  readonly children: React.ReactNode;
  readonly forceVisible: boolean;
}): React.ReactNode {
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
    return (): void => observer.disconnect();
  }, [forceVisible, visible]);

  if (!visible) {
    return <div ref={ref} className="h-[180px]" />;
  }

  return <>{children}</>;
}

const TH_CLASS =
  'bg-[var(--bg-th)] border border-[var(--border-color)] px-2 py-2.5 text-center font-bold text-xs uppercase tracking-wide text-[var(--text-label)]';

const TH_SUB_CLASS =
  'font-mono bg-[var(--bg-th)] border border-[var(--border-color)] px-2 py-2.5 text-center font-bold text-xs uppercase tracking-widest text-[var(--text-label)]';

function buildSubHeaders(maxSlots: number): React.ReactNode[] {
  const headers: React.ReactNode[] = [];
  for (let i = 0; i < maxSlots; i++) {
    headers.push(
      <th key={`ex-${i}`} scope="col" className={TH_SUB_CLASS}>
        Ejercicio
      </th>,
      <th key={`kg-${i}`} scope="col" className={TH_SUB_CLASS}>
        kg
      </th>,
      <th key={`res-${i}`} scope="col" className={TH_SUB_CLASS}>
        Resultado
      </th>
    );
  }
  return headers;
}

export function GenericWeekSection({
  week,
  rows,
  firstPendingIdx,
  forceExpanded,
  onMark,
  onSetAmrapReps,
  onSetRpe,
  onUndo,
}: GenericWeekSectionProps): React.ReactNode {
  const weekDone = rows.every((r) => r.slots.every((s) => s.result !== undefined));

  const startWo = rows[0].index + 1;
  const endWo = rows[rows.length - 1].index + 1;

  const workoutsPerWeek = rows.length;
  const currentWeek = firstPendingIdx >= 0 ? Math.floor(firstPendingIdx / workoutsPerWeek) + 1 : 1;
  const forceVisible = forceExpanded === true || Math.abs(week - currentWeek) <= 1;

  const [collapsed, setCollapsed] = useState(!forceVisible);

  const maxSlots = useMemo(() => rows.reduce((max, r) => Math.max(max, r.slots.length), 0), [rows]);

  return (
    <div className="mb-8 break-inside-avoid">
      <button
        type="button"
        className={`w-full bg-[var(--bg-header)] text-[var(--text-header)] px-5 py-3.5 flex justify-between items-center select-none border-none ${forceExpanded ? 'cursor-default' : 'cursor-pointer hover:opacity-90'}`}
        aria-expanded={!collapsed}
        onClick={forceExpanded ? undefined : () => setCollapsed(!collapsed)}
      >
        <span
          className="font-display flex items-center gap-2.5"
          style={{ fontSize: '20px', letterSpacing: '0.05em' }}
        >
          Semana {week}
          {weekDone && (
            <span className="inline-block week-badge bg-[var(--text-header)] text-[var(--bg-header)] px-2.5 py-0.5">
              LISTO &#10003;
            </span>
          )}
        </span>
        <span
          className="font-mono opacity-50 tabular-nums"
          style={{ fontSize: '10px', letterSpacing: '0.1em' }}
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
                  <th scope="col" rowSpan={2} className={`${TH_CLASS} w-[4%]`}>
                    #
                  </th>
                  <th scope="col" rowSpan={2} className={`${TH_CLASS} w-[5%]`}>
                    Día
                  </th>
                  {Array.from({ length: maxSlots }, (_, i) => (
                    <th key={i} scope="col" colSpan={3} className={TH_CLASS}>
                      Ejercicio {i + 1}
                    </th>
                  ))}
                </tr>
                <tr>{buildSubHeaders(maxSlots)}</tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <GenericWorkoutRowComponent
                    key={row.index}
                    row={row}
                    maxSlots={maxSlots}
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
              <GenericWorkoutCard
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
