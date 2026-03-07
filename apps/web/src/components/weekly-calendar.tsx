import { useState, useMemo } from 'react';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Spanish day abbreviations Mon-Sun. */
const DAY_ABBREVS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

/** Full Spanish day names for ARIA labels. */
const DAY_NAMES_ES = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
] as const;

const MS_PER_DAY = 86_400_000;
const DAYS_IN_WEEK = 7;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the Monday 00:00 UTC of the ISO week containing `date`. */
function getMonday(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon...
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  d.setUTCDate(d.getUTCDate() + diff);
  return d;
}

/** Format a Date as "d de month" in Spanish. */
function formatDateEs(date: Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(date);
}

/** Format a week label like "3 mar – 9 mar 2026". */
function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday.getTime() + 6 * MS_PER_DAY);
  const fmtShort = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
  const fmtYear = new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return `${fmtShort.format(monday)} – ${fmtYear.format(sunday)}`;
}

interface CompletedEntry {
  readonly dayName: string;
  readonly dayIndex: number; // 0=Mon ... 6=Sun
}

// ---------------------------------------------------------------------------
// Component Props
// ---------------------------------------------------------------------------

export interface WeeklyCalendarProps {
  /** Maps workout index (as string) to ISO date string when workout was completed. */
  readonly completedDates: Readonly<Record<string, string>>;
  /** Maps workout index (as string) to the workout day name from the definition. */
  readonly dayNames: Readonly<Record<string, string>>;
}

// ---------------------------------------------------------------------------
// WeeklyCalendar
// ---------------------------------------------------------------------------

export function WeeklyCalendar({ completedDates, dayNames }: WeeklyCalendarProps): ReactNode {
  const [weekOffset, setWeekOffset] = useState(0);

  // Group completed workouts by ISO week Monday timestamp.
  const weekMap = useMemo(() => {
    const map = new Map<number, CompletedEntry[]>();
    for (const [workoutIndex, isoDate] of Object.entries(completedDates)) {
      const date = new Date(isoDate);
      if (Number.isNaN(date.getTime())) continue;
      const monday = getMonday(date);
      const mondayTs = monday.getTime();
      const dayIndex = Math.round((date.getTime() - mondayTs) / MS_PER_DAY);
      if (dayIndex < 0 || dayIndex >= DAYS_IN_WEEK) continue;

      const entries = map.get(mondayTs) ?? [];
      entries.push({
        dayName: dayNames[workoutIndex] ?? `#${Number(workoutIndex) + 1}`,
        dayIndex,
      });
      map.set(mondayTs, entries);
    }
    return map;
  }, [completedDates, dayNames]);

  // Current week's Monday.
  const currentMonday = useMemo(() => getMonday(new Date()), []);
  const displayMonday = new Date(currentMonday.getTime() + weekOffset * DAYS_IN_WEEK * MS_PER_DAY);
  const displayMondayTs = displayMonday.getTime();
  const isCurrentWeek = weekOffset === 0;

  // Entries for the displayed week.
  const weekEntries = weekMap.get(displayMondayTs) ?? [];

  // Build a lookup: dayIndex -> CompletedEntry[].
  const dayLookup = useMemo(() => {
    const lookup = new Map<number, CompletedEntry[]>();
    for (const entry of weekEntries) {
      const list = lookup.get(entry.dayIndex) ?? [];
      list.push(entry);
      lookup.set(entry.dayIndex, list);
    }
    return lookup;
  }, [weekEntries]);

  const handlePrevWeek = (): void => setWeekOffset((o) => o - 1);
  const handleNextWeek = (): void => setWeekOffset((o) => o + 1);

  return (
    <div className="bg-card border border-rule p-4 sm:p-5">
      {/* Header with navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={handlePrevWeek}
          aria-label="Semana anterior"
          className="text-xs font-bold px-3 py-2 min-h-[44px] min-w-[44px] border-2 border-rule bg-card text-muted cursor-pointer transition-all duration-150 hover:bg-hover-row hover:text-main hover:border-rule-light active:scale-95"
        >
          &larr;
        </button>

        <div className="flex flex-col items-center gap-0.5">
          <span className="text-xs font-bold text-main tracking-wide uppercase">
            {isCurrentWeek ? 'Esta semana' : formatWeekLabel(displayMonday)}
          </span>
          {isCurrentWeek && (
            <span className="text-[10px] font-mono text-muted">
              {formatWeekLabel(displayMonday)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleNextWeek}
          aria-label="Semana siguiente"
          className="text-xs font-bold px-3 py-2 min-h-[44px] min-w-[44px] border-2 border-rule bg-card text-muted cursor-pointer transition-all duration-150 hover:bg-hover-row hover:text-main hover:border-rule-light active:scale-95"
        >
          &rarr;
        </button>
      </div>

      {/* 7-column grid */}
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Calendario semanal">
        {DAY_ABBREVS.map((abbrev, i) => {
          const cellDate = new Date(displayMonday.getTime() + i * MS_PER_DAY);
          const entries = dayLookup.get(i);
          const hasWorkout = entries !== undefined && entries.length > 0;
          const dateLabel = formatDateEs(cellDate);

          const ariaLabel = hasWorkout
            ? `${DAY_NAMES_ES[i]} ${dateLabel}: ${entries.map((e) => e.dayName).join(', ')} completado`
            : `${DAY_NAMES_ES[i]} ${dateLabel}: sin entrenamiento`;

          return (
            <div
              key={i}
              role="gridcell"
              aria-label={ariaLabel}
              className={`flex flex-col items-center py-2 px-1 rounded-sm ${
                hasWorkout ? 'bg-hover-row' : ''
              }`}
            >
              <span
                className={`text-[10px] font-mono tracking-wider ${
                  hasWorkout ? 'text-main font-bold' : 'text-muted'
                }`}
              >
                {abbrev}
              </span>
              <div className="mt-1.5 flex flex-col items-center gap-1">
                {hasWorkout ? (
                  entries.map((entry, idx) => (
                    <div key={idx} className="flex flex-col items-center">
                      <span className="text-accent text-sm">{'\u25CF'}</span>
                      <span className="text-[9px] text-main font-semibold leading-tight text-center truncate max-w-[48px]">
                        {entry.dayName}
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-muted text-sm">{'\u25CB'}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
