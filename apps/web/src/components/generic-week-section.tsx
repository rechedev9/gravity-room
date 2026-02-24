import { useState, useRef, useEffect } from 'react';
import type { GenericWorkoutRow, ResultValue } from '@gzclp/shared/types';
import { GenericWorkoutCard } from './generic-workout-card';

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
          <div className="overflow-x-auto">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-3 lg:min-w-max">
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
          </div>
        </LazyContent>
      )}
    </div>
  );
}
