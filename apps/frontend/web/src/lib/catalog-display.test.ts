import { describe, expect, it } from 'vitest';
import type { TFunction } from 'i18next';
import {
  isCycleDayName,
  localizedConfigFieldLabel,
  localizedDayName,
  localizedExerciseName,
} from './catalog-display';

function makeT(map: Record<string, string>): TFunction {
  return ((key: string, opts?: { defaultValue?: string }) => {
    return map[key] ?? opts?.defaultValue ?? key;
  }) as TFunction;
}

describe('localizedExerciseName', () => {
  it('prefers the catalog translation when present', () => {
    const t = makeT({ 'catalog.exercises.squat': 'Squat' });
    expect(localizedExerciseName(t, 'squat', 'Sentadilla')).toBe('Squat');
  });

  it('falls back to the seed name when untranslated', () => {
    const t = makeT({});
    expect(localizedExerciseName(t, 'obscure-lift', 'Curl Raro')).toBe('Curl Raro');
  });
});

describe('localizedConfigFieldLabel', () => {
  it('reuses exercise keys for weight-field labels', () => {
    const t = makeT({ 'catalog.exercises.bench': 'Bench Press' });
    expect(localizedConfigFieldLabel(t, 'bench', 'Press Banca')).toBe('Bench Press');
  });
});

describe('cycle day names', () => {
  const t = makeT({ 'tracker.day_status.day_name': 'Day N' });

  it('recognises the position-only names the seeds use, in either spelling', () => {
    expect(isCycleDayName('Día 3')).toBe(true);
    expect(isCycleDayName('dia 12')).toBe(true);
    expect(isCycleDayName('Lun — Hombros/Tríceps')).toBe(false);
    expect(isCycleDayName('Push A')).toBe(false);
  });

  it('translates a cycle day name and leaves descriptive names alone', () => {
    expect(localizedDayName(t, 'Día 3')).toBe('Day N');
    expect(localizedDayName(t, 'Push A')).toBe('Push A');
  });
});
