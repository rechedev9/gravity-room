import { describe, expect, it } from 'vitest';
import { humanizeExerciseId } from './program-json-ld';

describe('humanizeExerciseId', () => {
  it('prefers the provided display name map', () => {
    expect(humanizeExerciseId('squat', { squat: 'Sentadilla' })).toBe('Sentadilla');
  });

  it('expands known short ids used in program seeds', () => {
    expect(humanizeExerciseId('ohp')).toBe('Overhead Press');
    expect(humanizeExerciseId('dbrow')).toBe('Dumbbell Row');
    expect(humanizeExerciseId('latpulldown')).toBe('Lat Pulldown');
  });

  it('title-cases snake_case ids and parenthesises equipment', () => {
    expect(humanizeExerciseId('bench_press_barbell')).toBe('Bench Press (Barbell)');
    expect(humanizeExerciseId('face_pull')).toBe('Face Pull');
  });
});
