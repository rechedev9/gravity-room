import type { GenericWorkoutRow } from '@gzclp/shared/types';

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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

  for (const row of rows) {
    const week = Math.floor(row.index / workoutsPerWeek) + 1;
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
  link.click();
  URL.revokeObjectURL(url);
}
