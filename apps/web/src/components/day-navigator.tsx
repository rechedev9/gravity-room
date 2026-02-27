import type { ReactNode } from 'react';

export interface DayTab {
  readonly label: string;
  readonly isComplete: boolean;
}

interface DayNavigatorProps {
  readonly days: readonly DayTab[];
  readonly selectedDay: number;
  readonly currentDay: number;
  readonly onSelectDay: (index: number) => void;
}

export function DayNavigator({
  days,
  selectedDay,
  currentDay,
  onSelectDay,
}: DayNavigatorProps): ReactNode {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1 scrollbar-none"
      role="tablist"
      aria-label="Días de la semana"
    >
      {days.map((day, i) => {
        const isSelected = i === selectedDay;
        const isCurrent = i === currentDay;

        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={isSelected}
            onClick={() => onSelectDay(i)}
            className={`shrink-0 px-4 py-2.5 min-h-[44px] text-[12px] font-bold uppercase tracking-wider border-2 cursor-pointer transition-all duration-150 active:scale-95 ${
              isSelected
                ? 'bg-accent text-white border-accent shadow-[0_0_16px_rgba(232,170,32,0.2)]'
                : isCurrent
                  ? 'bg-card text-muted border-accent hover:text-main hover:shadow-[0_0_12px_rgba(232,170,32,0.1)]'
                  : 'bg-card text-muted border-rule hover:border-rule-light hover:text-main'
            }`}
          >
            <span className="mr-1.5">{day.isComplete ? '\u25CF' : '\u25CB'}</span>
            Entreno {i + 1}
          </button>
        );
      })}
    </div>
  );
}
