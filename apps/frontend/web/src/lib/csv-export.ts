import type { GenericWorkoutRow } from '@gzclp/domain/types';

function escapeCsvField(value: string): string {
  // Spreadsheet applications interpret these leading characters as formulas.
  // Prefix an apostrophe so user-controlled exercise/day names remain text
  // when the CSV is opened in Excel, Numbers, or LibreOffice.
  const safeValue = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (
    safeValue.includes(',') ||
    safeValue.includes('"') ||
    safeValue.includes('\n') ||
    safeValue.includes('\r')
  ) {
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
  return safeValue;
}

export function generateProgramCsv(
  rows: readonly GenericWorkoutRow[],
  workoutsPerWeek: number
): string {
  const headers = [
    'Week',
    'Workout',
    'Day',
    'Exercise',
    'Tier',
    'Sets',
    'Reps',
    'Weight (kg)',
    'Result',
    'AMRAP Reps',
    'RPE',
  ];

  const lines: string[] = [headers.join(',')];

  const workoutsPerWeekSafe =
    Number.isFinite(workoutsPerWeek) && workoutsPerWeek >= 1 ? workoutsPerWeek : 1;
  for (const row of rows) {
    const week = Math.floor(row.index / workoutsPerWeekSafe) + 1;
    const workoutNum = row.index + 1;

    for (const slot of row.slots) {
      const repsLabel =
        slot.repsMax !== undefined
          ? `${slot.reps}-${slot.repsMax}${slot.isAmrap ? '+' : ''}`
          : `${slot.reps}${slot.isAmrap ? '+' : ''}`;

      const fields = [
        String(week),
        String(workoutNum),
        escapeCsvField(row.dayName),
        escapeCsvField(slot.exerciseName),
        slot.tier.toUpperCase(),
        String(slot.sets),
        repsLabel,
        String(slot.weight),
        slot.result ?? '',
        slot.amrapReps !== undefined ? String(slot.amrapReps) : '',
        slot.rpe !== undefined ? String(slot.rpe) : '',
      ];

      lines.push(fields.join(','));
    }
  }

  return lines.join('\n');
}

export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Some browsers consume the object URL after the click handler unwinds.
  // Revoking synchronously can therefore produce an empty/failed download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
