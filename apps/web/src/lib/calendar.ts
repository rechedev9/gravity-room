import type { ProgramDefinition } from '@gzclp/shared/types/program';
import type { GenericWorkoutRow } from '@gzclp/shared/types';

export interface CalendarEventOptions {
  readonly date?: string;
  readonly startHour?: number;
  readonly durationMinutes?: number;
}

export interface CalendarEvent {
  readonly calendarUrl: string;
  readonly title: string;
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
}

/** Format a Date as YYYY-MM-DD. */
function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Format a Date as YYYYMMDDTHHmmSS for Google Calendar URL (local time, no Z). */
function formatGoogleDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const sec = String(d.getSeconds()).padStart(2, '0');
  return `${y}${m}${day}T${h}${min}${sec}`;
}

/**
 * Build a Google Calendar URL for a workout row.
 * Returns a pre-filled event creation link — no OAuth or API keys needed.
 */
export function buildGoogleCalendarUrl(
  row: GenericWorkoutRow,
  definition: ProgramDefinition,
  options?: CalendarEventOptions
): CalendarEvent {
  const startHour = options?.startHour ?? 7;
  const durationMinutes = options?.durationMinutes ?? 60;

  let dateStr: string;
  if (options?.date) {
    dateStr = options.date;
  } else {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateStr = formatDateISO(tomorrow);
  }

  const exerciseNames = row.slots.map((s) => s.exerciseName);
  const title = `${definition.name} ${row.dayName} — ${exerciseNames.join(' / ')}`;

  const lines = [`Entrenamiento #${row.index + 1} — ${row.dayName}`, ''];
  for (const slot of row.slots) {
    lines.push(
      `${slot.tier.toUpperCase()}: ${slot.exerciseName} — ${slot.weight}kg` +
        ` (${slot.sets}\u00d7${slot.reps}, Etapa ${slot.stage + 1})`
    );
  }
  const description = lines.join('\n');

  // No 'Z' suffix: parsed as local time per ECMA-262, matching Google Calendar's local-time URL format.
  const startDate = new Date(`${dateStr}T${String(startHour).padStart(2, '0')}:00:00`);
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);

  const calendarUrl =
    'https://calendar.google.com/calendar/render?action=TEMPLATE' +
    `&text=${encodeURIComponent(title)}` +
    `&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}` +
    `&details=${encodeURIComponent(description)}`;

  const endHour = endDate.getHours();
  const endMinute = endDate.getMinutes();

  return {
    calendarUrl,
    title,
    date: dateStr,
    startTime: `${String(startHour).padStart(2, '0')}:00`,
    endTime: `${String(endHour).padStart(2, '0')}:${String(endMinute).padStart(2, '0')}`,
  };
}
