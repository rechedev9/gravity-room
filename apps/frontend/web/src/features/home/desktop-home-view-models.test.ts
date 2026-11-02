import { describe, expect, it } from 'vitest';
import type { GenericSlotRow, GenericWorkoutRow } from '@gzclp/domain/types';
import {
  buildLastSession,
  buildStageWarning,
  buildT1Loads,
  buildTodaySlots,
  buildWeekStrip,
  formatRest,
  slotScheme,
} from './desktop-home-view-models';

function slot(overrides: Partial<GenericSlotRow> & { slotId: string }): GenericSlotRow {
  return {
    exerciseId: overrides.slotId,
    exerciseName: overrides.slotId,
    tier: 'T1',
    weight: 60,
    stage: 1,
    sets: 5,
    reps: 3,
    repsMax: undefined,
    isAmrap: false,
    stagesCount: 3,
    result: undefined,
    amrapReps: undefined,
    rpe: undefined,
    isChanged: false,
    isDeload: false,
    role: 'primary',
    notes: undefined,
    prescriptions: undefined,
    isGpp: undefined,
    complexReps: undefined,
    propagatesTo: undefined,
    isTestSlot: undefined,
    isBodyweight: undefined,
    setLogs: undefined,
    ...overrides,
  };
}

function row(index: number, slots: readonly GenericSlotRow[]): GenericWorkoutRow {
  return { index, dayName: `D${index + 1}`, slots, isChanged: false, completedAt: undefined };
}

describe('slotScheme', () => {
  it('marks AMRAP prescriptions with a plus', () => {
    expect(slotScheme({ sets: 5, reps: 3, isAmrap: true })).toBe('5×3+');
    expect(slotScheme({ sets: 3, reps: 10, isAmrap: false })).toBe('3×10');
  });
});

describe('formatRest', () => {
  it('formats m:ss', () => {
    expect(formatRest(180)).toBe('3:00');
    expect(formatRest(90)).toBe('1:30');
    expect(formatRest(120)).toBe('2:00');
  });
});

describe('buildTodaySlots', () => {
  it('keeps program order and one entry per slot', () => {
    const slots = buildTodaySlots(
      row(0, [
        slot({ slotId: 'a', tier: 'T1', weight: 70, isAmrap: true }),
        slot({ slotId: 'b', tier: 'T2', role: 'secondary', weight: 40 }),
      ])
    );
    expect(slots.map((entry) => entry.id)).toEqual(['a', 'b']);
    expect(slots[0]).toMatchObject({ scheme: '5×3+', weight: 70, restSeconds: 180 });
    expect(slots[1]).toMatchObject({ restSeconds: 120 });
  });

  it('is empty without a pending row', () => {
    expect(buildTodaySlots(undefined)).toEqual([]);
  });
});

describe('buildWeekStrip', () => {
  const now = new Date(2026, 10, 4, 15, 0, 0);
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  monday.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(9, 0, 0, 0);
  // Completed workouts carry a wall-clock time; a local-midnight ISO would
  // round-trip to the previous UTC day and is not what the API sends.
  const atNoon = (date: Date): string => new Date(date.getTime() + 12 * 3_600_000).toISOString();

  it('marks completed days, today and the rest as idle', () => {
    // Only Monday is logged; `now` is later that week, so today stays "today".
    const strip = buildWeekStrip([atNoon(monday)], now, 'es-ES');
    expect(strip.days).toHaveLength(7);
    // Index 0 is Monday; today sits at the weekday offset.
    expect(strip.days[0]?.state).toBe('done');
    expect(strip.days[mondayOffset]?.state).toBe('today');
    expect(strip.days.filter((day) => day.state === 'today')).toHaveLength(1);
    expect(strip.days.every((day) => day.label.length > 0)).toBe(true);
  });

  it('marks today as done when a session was already logged', () => {
    const strip = buildWeekStrip([atNoon(today)], now, 'es-ES');
    expect(strip.days[today.getDay() === 0 ? 6 : today.getDay() - 1]?.state).toBe('done');
  });

  it('counts only workouts inside the strip', () => {
    const lastWeek = new Date(monday);
    lastWeek.setDate(monday.getDate() - 3);
    const strip = buildWeekStrip([atNoon(lastWeek), atNoon(monday)], now, 'es-ES');
    expect(strip.doneThisWeek).toBe(1);
  });

  it('is empty when nothing was logged', () => {
    const strip = buildWeekStrip([], now, 'es-ES');
    expect(strip.doneThisWeek).toBe(0);
    expect(strip.days.some((day) => day.state === 'done')).toBe(false);
  });
});

describe('buildT1Loads', () => {
  const completed = (index: number, weight: number): GenericWorkoutRow =>
    row(index, [slot({ slotId: 'squat', exerciseName: 'Sentadilla', weight, result: 'success' })]);

  it('keeps the series up to the pending day and ignores the future', () => {
    const loads = buildT1Loads([
      completed(0, 60),
      completed(1, 62.5),
      row(2, [slot({ slotId: 'squat', exerciseName: 'Sentadilla', weight: 65 })]),
      row(3, [slot({ slotId: 'squat', exerciseName: 'Sentadilla', weight: 90 })]),
    ]);
    expect(loads).toHaveLength(1);
    expect(loads[0]).toMatchObject({
      lift: 'Sentadilla',
      weight: 65,
      series: [60, 62.5, 65],
    });
  });

  it('skips bodyweight and non-primary slots', () => {
    const loads = buildT1Loads([
      row(0, [
        slot({ slotId: 'pushup', weight: 0 }),
        slot({ slotId: 'curl', role: 'accessory', weight: 20 }),
      ]),
    ]);
    expect(loads).toEqual([]);
  });
});

describe('buildStageWarning', () => {
  it('reports a primary lift that advanced stage after a failure', () => {
    const warning = buildStageWarning([
      row(0, [slot({ slotId: 'press', exerciseName: 'Press Militar', result: 'fail' })]),
      row(1, [
        slot({
          slotId: 'press',
          exerciseName: 'Press Militar',
          stage: 2,
          sets: 6,
          reps: 2,
          isAmrap: true,
        }),
      ]),
    ]);
    expect(warning).toEqual({ lift: 'Press Militar', scheme: '6×2+', day: 1 });
  });

  it('stays silent when the stage did not change', () => {
    const warning = buildStageWarning([
      row(0, [slot({ slotId: 'press', result: 'fail' })]),
      row(1, [slot({ slotId: 'press' })]),
    ]);
    expect(warning).toBeNull();
  });
});

describe('buildLastSession', () => {
  it('returns the most recent completed workout with its logged numbers', () => {
    const last = buildLastSession(
      [
        row(0, [slot({ slotId: 'a', result: 'success' })]),
        row(1, [
          slot({ slotId: 'a', weight: 70, result: 'success' }),
          slot({ slotId: 'b', tier: 'T3', weight: 0, reps: 25, amrapReps: 28, result: 'success' }),
        ]),
      ],
      { '1': '2026-11-01T09:00:00.000Z' }
    );
    expect(last?.day).toBe(2);
    expect(last?.slots.map((entry) => [entry.id, entry.weight, entry.reps])).toEqual([
      ['a', 70, 3],
      ['b', 0, 28],
    ]);
    expect(last?.dateLabel).not.toBe('');
  });

  it('is null before the first completed session', () => {
    expect(buildLastSession([row(0, [slot({ slotId: 'a' })])], {})).toBeNull();
  });
});
