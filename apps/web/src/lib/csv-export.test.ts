/**
 * csv-export stress tests — boundary, fuzz, and round-trip coverage.
 *
 * Tensions targeted:
 *   - workoutsPerWeek=0 → Math.floor(x/0)+1 = Infinity in Week column (BUG)
 *   - workoutsPerWeek<0 → week numbers become 0 or negative
 *   - escapeCsvField: comma, double-quote, newline, CR+LF, tab, embedded null
 *   - CSV formula injection: fields starting with =, +, -, @ pass through unquoted
 *   - Unicode: emoji, RTL markers, surrogate-adjacent code points, ZWJ sequences
 *   - Empty program: only header row
 *   - Row with zero slots: contributes no data lines
 *   - Very long exercise name
 *   - downloadCsv: URL.revokeObjectURL called before download can start (documented)
 */

import { describe, it, expect } from 'bun:test';
import { generateProgramCsv } from './csv-export';
import type { GenericWorkoutRow, ResultValue } from '@gzclp/domain/types';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeSlot(
  overrides: Partial<{
    slotId: string;
    exerciseId: string;
    exerciseName: string;
    tier: string;
    weight: number;
    stage: number;
    sets: number;
    reps: number;
    repsMax: number | undefined;
    isAmrap: boolean;
    stagesCount: number;
    result: ResultValue | undefined;
    amrapReps: number | undefined;
    rpe: number | undefined;
    isChanged: boolean;
    isDeload: boolean;
    role: 'primary' | 'secondary' | 'accessory' | undefined;
    notes: string | undefined;
    prescriptions: undefined;
    isGpp: undefined;
    complexReps: undefined;
    propagatesTo: undefined;
    isTestSlot: undefined;
    isBodyweight: undefined;
    setLogs: undefined;
  }> = {}
): GenericWorkoutRow['slots'][number] {
  return {
    slotId: 'slot-1',
    exerciseId: 'squat',
    exerciseName: 'Squat',
    tier: 't1',
    weight: 100,
    stage: 0,
    sets: 5,
    reps: 5,
    repsMax: undefined,
    isAmrap: false,
    stagesCount: 3,
    result: undefined,
    amrapReps: undefined,
    rpe: undefined,
    isChanged: false,
    isDeload: false,
    role: undefined,
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

function makeRow(
  index: number,
  dayName: string,
  slots: GenericWorkoutRow['slots']
): GenericWorkoutRow {
  return { index, dayName, slots, isChanged: false, completedAt: undefined };
}

const HEADER = 'Week,Workout,Day,Exercise,Tier,Sets,Reps,Weight (kg),Result,AMRAP Reps,RPE';

// ---------------------------------------------------------------------------
// 1. BOUNDARY: workoutsPerWeek = 0 (BUG: produces Infinity in Week column)
// ---------------------------------------------------------------------------

describe('generateProgramCsv — workoutsPerWeek boundary', () => {
  it('workoutsPerWeek=0 falls back to 1 (fixed)', () => {
    // safeWpw = Math.max(1, 0) = 1 → week = Math.floor(index / 1) + 1
    const rows = [makeRow(0, 'Day A', [makeSlot()])];
    const csv = generateProgramCsv(rows, 0);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]!.split(',')[0]).toBe('1');
  });

  it('workoutsPerWeek=0 with index≥1 falls back to 1 (fixed)', () => {
    const rows = [makeRow(1, 'Day B', [makeSlot()])];
    const csv = generateProgramCsv(rows, 0);
    const weekValue = csv.split('\n')[1]!.split(',')[0];
    // safeWpw=1 → week = Math.floor(1/1)+1 = 2
    expect(weekValue).toBe('2');
  });

  it('workoutsPerWeek=1 produces correct week numbers', () => {
    const rows = [
      makeRow(0, 'Day A', [makeSlot()]),
      makeRow(1, 'Day A', [makeSlot()]),
      makeRow(2, 'Day A', [makeSlot()]),
    ];
    const csv = generateProgramCsv(rows, 1);
    const lines = csv.split('\n');
    expect(lines[1]!.split(',')[0]).toBe('1'); // workout 0 → week 1
    expect(lines[2]!.split(',')[0]).toBe('2'); // workout 1 → week 2
    expect(lines[3]!.split(',')[0]).toBe('3'); // workout 2 → week 3
  });

  it('workoutsPerWeek=-1 falls back to 1 (fixed)', () => {
    // safeWpw = Math.max(1, -1) = 1 → weeks increment normally
    const rows = [makeRow(0, 'Day A', [makeSlot()]), makeRow(1, 'Day A', [makeSlot()])];
    const csv = generateProgramCsv(rows, -1);
    const lines = csv.split('\n');
    const week1 = Number(lines[1]!.split(',')[0]);
    const week2 = Number(lines[2]!.split(',')[0]);
    expect(week1).toBe(1);
    expect(week2).toBe(2);
  });

  it('workoutsPerWeek=3 groups workouts correctly', () => {
    const rows = Array.from({ length: 9 }, (_, i) => makeRow(i, 'Day', [makeSlot()]));
    const csv = generateProgramCsv(rows, 3);
    const lines = csv.split('\n');
    // Workouts 0,1,2 → week 1
    expect(lines[1]!.split(',')[0]).toBe('1');
    expect(lines[2]!.split(',')[0]).toBe('1');
    expect(lines[3]!.split(',')[0]).toBe('1');
    // Workouts 3,4,5 → week 2
    expect(lines[4]!.split(',')[0]).toBe('2');
    // Workouts 6,7,8 → week 3
    expect(lines[7]!.split(',')[0]).toBe('3');
  });
});

// ---------------------------------------------------------------------------
// 2. BOUNDARY: empty inputs
// ---------------------------------------------------------------------------

describe('generateProgramCsv — empty inputs', () => {
  it('empty rows produces header only', () => {
    const csv = generateProgramCsv([], 3);
    expect(csv).toBe(HEADER);
    expect(csv.split('\n')).toHaveLength(1);
  });

  it('row with no slots produces no data lines', () => {
    const rows = [makeRow(0, 'Rest Day', [])];
    const csv = generateProgramCsv(rows, 3);
    expect(csv).toBe(HEADER);
  });

  it('mix of empty and non-empty slot rows', () => {
    const rows = [
      makeRow(0, 'Rest', []),
      makeRow(1, 'Day A', [makeSlot({ exerciseName: 'Squat' })]),
      makeRow(2, 'Rest', []),
    ];
    const csv = generateProgramCsv(rows, 3);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2); // header + 1 data line
    expect(lines[1]).toContain('Squat');
  });
});

// ---------------------------------------------------------------------------
// 3. BOUNDARY: field escaping — comma, quote, newline, CR+LF, tab
// ---------------------------------------------------------------------------

describe('generateProgramCsv — CSV field escaping', () => {
  it('exercise name with comma is wrapped in double quotes', () => {
    const rows = [makeRow(0, 'Day A', [makeSlot({ exerciseName: 'Bench, Incline' })])];
    const csv = generateProgramCsv(rows, 3);
    const dataLine = csv.split('\n')[1]!;
    expect(dataLine).toContain('"Bench, Incline"');
  });

  it('exercise name with double quote escapes the quote', () => {
    const rows = [makeRow(0, 'Day A', [makeSlot({ exerciseName: 'Pull"Up' })])];
    const csv = generateProgramCsv(rows, 3);
    const dataLine = csv.split('\n')[1]!;
    expect(dataLine).toContain('"Pull""Up"');
  });

  it('exercise name with newline is wrapped in double quotes', () => {
    const rows = [makeRow(0, 'Day A', [makeSlot({ exerciseName: 'Over\nHead' })])];
    const csv = generateProgramCsv(rows, 3);
    // The field must be quoted when it contains a newline
    expect(csv).toContain('"Over\nHead"');
  });

  it('day name with comma is wrapped in double quotes', () => {
    const rows = [makeRow(0, 'Upper, Lower', [makeSlot()])];
    const csv = generateProgramCsv(rows, 3);
    expect(csv).toContain('"Upper, Lower"');
  });

  it('exercise name with both comma and quote is doubly escaped', () => {
    const rows = [makeRow(0, 'Day A', [makeSlot({ exerciseName: 'A "heavy", Squat' })])];
    const csv = generateProgramCsv(rows, 3);
    expect(csv).toContain('"A ""heavy"", Squat"');
  });

  it('plain field is not quoted', () => {
    const rows = [makeRow(0, 'Day A', [makeSlot({ exerciseName: 'Squat' })])];
    const csv = generateProgramCsv(rows, 3);
    const dataLine = csv.split('\n')[1]!;
    // Should appear unquoted between commas
    expect(dataLine).toContain(',Squat,');
  });
});

// ---------------------------------------------------------------------------
// 4. CSV formula injection — fields starting with =, +, -, @
// ---------------------------------------------------------------------------

describe('generateProgramCsv — CSV injection (no sanitization)', () => {
  // These tests document that the current implementation does NOT sanitize
  // formula-injection characters. Spreadsheet apps like Excel may execute
  // these as formulas if the CSV is opened directly.
  const injectionNames = [
    '=CMD|"/C calc"!A0',
    '+1+1+1',
    '-1+1+1',
    '@SUM(1+1)',
    '=HYPERLINK("http://evil.com","Click")',
  ];

  for (const name of injectionNames) {
    it(`passes "${name.slice(0, 20)}..." through without sanitization`, () => {
      const rows = [makeRow(0, 'Day A', [makeSlot({ exerciseName: name })])];
      const csv = generateProgramCsv(rows, 3);
      // The name appears in the CSV (may be quoted if it contains comma/quote/newline)
      expect(csv).toContain(name.replace(/"/g, '""'));
    });
  }
});

// ---------------------------------------------------------------------------
// 5. BOUNDARY: unicode fields
// ---------------------------------------------------------------------------

describe('generateProgramCsv — unicode in fields', () => {
  it('emoji in exercise name round-trips correctly', () => {
    const name = '🏋️ Deadlift';
    const rows = [makeRow(0, 'Day A', [makeSlot({ exerciseName: name })])];
    const csv = generateProgramCsv(rows, 3);
    expect(csv).toContain(name);
  });

  it('RTL text (Arabic) in exercise name round-trips correctly', () => {
    const name = 'تمرين القرفصاء';
    const rows = [makeRow(0, 'Day A', [makeSlot({ exerciseName: name })])];
    const csv = generateProgramCsv(rows, 3);
    expect(csv).toContain(name);
  });

  it('ZWJ sequence in exercise name round-trips correctly', () => {
    const name = 'Lift\u200D\u200DPress'; // ZWJ joined
    const rows = [makeRow(0, 'Day A', [makeSlot({ exerciseName: name })])];
    const csv = generateProgramCsv(rows, 3);
    expect(csv).toContain(name);
  });

  it('null character in day name does not crash', () => {
    const rows = [makeRow(0, 'Day\x00A', [makeSlot()])];
    expect(() => generateProgramCsv(rows, 3)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 6. BOUNDARY: optional slot fields (undefined → empty CSV columns)
// ---------------------------------------------------------------------------

describe('generateProgramCsv — optional slot fields', () => {
  it('undefined result, amrapReps, rpe produce empty columns', () => {
    const rows = [
      makeRow(0, 'Day A', [makeSlot({ result: undefined, amrapReps: undefined, rpe: undefined })]),
    ];
    const csv = generateProgramCsv(rows, 3);
    const dataLine = csv.split('\n')[1]!;
    // Last three columns: Result, AMRAP Reps, RPE — all empty
    expect(dataLine.endsWith(',,')).toBe(true);
  });

  it('defined result propagates to Result column', () => {
    const rows = [makeRow(0, 'Day A', [makeSlot({ result: 'success' })])];
    const csv = generateProgramCsv(rows, 3);
    expect(csv).toContain('success');
  });

  it('defined amrapReps appears in AMRAP Reps column', () => {
    const rows = [makeRow(0, 'Day A', [makeSlot({ amrapReps: 12 })])];
    const csv = generateProgramCsv(rows, 3);
    const dataLine = csv.split('\n')[1]!;
    const cols = dataLine.split(',');
    expect(cols[9]).toBe('12'); // AMRAP Reps column (0-indexed: 9)
  });

  it('defined rpe appears in RPE column', () => {
    const rows = [makeRow(0, 'Day A', [makeSlot({ rpe: 8 })])];
    const csv = generateProgramCsv(rows, 3);
    const dataLine = csv.split('\n')[1]!;
    const cols = dataLine.split(',');
    expect(cols[10]).toBe('8'); // RPE column
  });

  it('isAmrap=true appends + to reps label', () => {
    const rows = [makeRow(0, 'Day A', [makeSlot({ reps: 5, isAmrap: true })])];
    const csv = generateProgramCsv(rows, 3);
    expect(csv).toContain('5+');
  });

  it('repsMax defined produces range label (min-max)', () => {
    const rows = [makeRow(0, 'Day A', [makeSlot({ reps: 5, repsMax: 8, isAmrap: false })])];
    const csv = generateProgramCsv(rows, 3);
    expect(csv).toContain('5-8');
  });

  it('repsMax with isAmrap appends + to range', () => {
    const rows = [makeRow(0, 'Day A', [makeSlot({ reps: 5, repsMax: 8, isAmrap: true })])];
    const csv = generateProgramCsv(rows, 3);
    expect(csv).toContain('5-8+');
  });
});

// ---------------------------------------------------------------------------
// 7. STRESS: very long exercise name
// ---------------------------------------------------------------------------

describe('generateProgramCsv — very long values', () => {
  it('exercise name of 100 000 chars does not crash', () => {
    const name = 'A'.repeat(100_000);
    const rows = [makeRow(0, 'Day A', [makeSlot({ exerciseName: name })])];
    expect(() => generateProgramCsv(rows, 3)).not.toThrow();
  });

  it('1000 rows with 10 slots each produces correct line count', () => {
    const rows = Array.from({ length: 1000 }, (_, i) =>
      makeRow(
        i,
        'Day A',
        Array.from({ length: 10 }, (_, j) => makeSlot({ slotId: `s${j}` }))
      )
    );
    const csv = generateProgramCsv(rows, 5);
    const lines = csv.split('\n');
    // 1 header + 1000 rows × 10 slots = 10 001 lines
    expect(lines).toHaveLength(10_001);
  });

  it('tier.toUpperCase() is applied', () => {
    const rows = [makeRow(0, 'Day A', [makeSlot({ tier: 't1' })])];
    const csv = generateProgramCsv(rows, 3);
    expect(csv).toContain('T1');
  });
});

// ---------------------------------------------------------------------------
// 8. ROUND-TRIP: Workout and Week numbering consistency
// ---------------------------------------------------------------------------

describe('generateProgramCsv — Workout column numbering', () => {
  it('Workout column is 1-indexed (row.index + 1)', () => {
    const rows = [makeRow(0, 'Day A', [makeSlot()]), makeRow(4, 'Day A', [makeSlot()])];
    const csv = generateProgramCsv(rows, 3);
    const lines = csv.split('\n');
    expect(lines[1]!.split(',')[1]).toBe('1'); // index 0 → workout 1
    expect(lines[2]!.split(',')[1]).toBe('5'); // index 4 → workout 5
  });

  it('multiple slots in same row share the same Week/Workout/Day', () => {
    const rows = [
      makeRow(0, 'Day A', [
        makeSlot({ slotId: 's1', exerciseName: 'Squat' }),
        makeSlot({ slotId: 's2', exerciseName: 'Bench' }),
      ]),
    ];
    const csv = generateProgramCsv(rows, 3);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3); // header + 2 slots
    const week1 = lines[1]!.split(',')[0];
    const week2 = lines[2]!.split(',')[0];
    expect(week1).toBe(week2);
    const workout1 = lines[1]!.split(',')[1];
    const workout2 = lines[2]!.split(',')[1];
    expect(workout1).toBe(workout2);
  });
});
