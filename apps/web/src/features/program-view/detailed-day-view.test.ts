import { describe, it, expect } from 'bun:test';
import type { GenericSlotRow, ResolvedPrescription } from '@gzclp/domain/types';
import { buildSetRows } from './detailed-day-view';

// ---------------------------------------------------------------------------
// Fixtures — minimal GenericSlotRow stubs (only fields buildSetRows reads)
// ---------------------------------------------------------------------------

function makeSlot(overrides: Partial<GenericSlotRow>): GenericSlotRow {
  return {
    slotId: 'slot-1',
    exerciseId: 'ex-1',
    exerciseName: 'Squat',
    tier: 'T1',
    weight: 60,
    stage: 0,
    sets: 3,
    reps: 5,
    repsMax: undefined,
    isAmrap: false,
    stagesCount: 1,
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
  } as GenericSlotRow;
}

// ---------------------------------------------------------------------------
// Task 4.1 — buildSetRows for standard slots (REQ-DDT-001)
// ---------------------------------------------------------------------------

describe('buildSetRows', () => {
  describe('standard slots', () => {
    it('returns the correct number of rows for a 3-set slot', () => {
      const slot = makeSlot({ sets: 3 });

      const rows = buildSetRows(slot);

      expect(rows).toHaveLength(3);
    });

    it('returns the correct number of rows for a 5-set slot', () => {
      const slot = makeSlot({ sets: 5 });

      const rows = buildSetRows(slot);

      expect(rows).toHaveLength(5);
    });

    it('labels rows sequentially starting from "1"', () => {
      const slot = makeSlot({ sets: 4 });

      const rows = buildSetRows(slot);

      expect(rows.map((r) => r.label)).toEqual(['1', '2', '3', '4']);
    });

    it('uses slot.weight as plannedWeight for every row', () => {
      const slot = makeSlot({ sets: 3, weight: 80 });

      const rows = buildSetRows(slot);

      expect(rows.every((r) => r.plannedWeight === 80)).toBe(true);
    });

    it('uses slot.reps as plannedReps for every row', () => {
      const slot = makeSlot({ sets: 3, reps: 8 });

      const rows = buildSetRows(slot);

      expect(rows.every((r) => r.plannedReps === 8)).toBe(true);
    });

    it('marks all rows as non-warmup', () => {
      const slot = makeSlot({ sets: 3 });

      const rows = buildSetRows(slot);

      expect(rows.every((r) => r.isWarmup === false)).toBe(true);
    });

    it('marks all rows as non-AMRAP when slot.isAmrap is false', () => {
      const slot = makeSlot({ sets: 3, isAmrap: false });

      const rows = buildSetRows(slot);

      expect(rows.every((r) => r.isAmrap === false)).toBe(true);
    });

    it('assigns sequential setIndex values starting from 0', () => {
      const slot = makeSlot({ sets: 3 });

      const rows = buildSetRows(slot);

      expect(rows.map((r) => r.setIndex)).toEqual([0, 1, 2]);
    });
  });

  // ---------------------------------------------------------------------------
  // Task 4.2 — buildSetRows for prescription, GPP/bodyweight, and AMRAP slots
  // (REQ-DDT-002, REQ-DDT-003, REQ-DDT-004)
  // ---------------------------------------------------------------------------

  describe('prescription slots', () => {
    const prescriptions: readonly ResolvedPrescription[] = [
      { percent: 50, reps: 5, sets: 2, weight: 30 },
      { percent: 70, reps: 3, sets: 1, weight: 42 },
      { percent: 100, reps: 5, sets: 3, weight: 60 },
    ];

    it('generates the correct total number of rows (sum of all prescription sets)', () => {
      const slot = makeSlot({ prescriptions, isAmrap: false });

      const rows = buildSetRows(slot);

      // 2 + 1 + 3 = 6 total rows
      expect(rows).toHaveLength(6);
    });

    it('labels warm-up rows as "W1", "W2", "W3"', () => {
      const slot = makeSlot({ prescriptions, isAmrap: false });

      const rows = buildSetRows(slot);

      // First two prescriptions are warm-ups (everything before last)
      // Prescription[0] has 2 sets -> W1, W2
      // Prescription[1] has 1 set -> W3
      const warmupLabels = rows.filter((r) => r.isWarmup).map((r) => r.label);

      expect(warmupLabels).toEqual(['W1', 'W2', 'W3']);
    });

    it('labels working set rows sequentially starting from "1"', () => {
      const slot = makeSlot({ prescriptions, isAmrap: false });

      const rows = buildSetRows(slot);

      // Last prescription has 3 sets -> working sets "1", "2", "3"
      const workingLabels = rows.filter((r) => !r.isWarmup).map((r) => r.label);

      expect(workingLabels).toEqual(['1', '2', '3']);
    });

    it('marks all non-last-prescription rows as warm-up', () => {
      const slot = makeSlot({ prescriptions, isAmrap: false });

      const rows = buildSetRows(slot);

      // First 3 rows are warm-ups (2 from first prescription + 1 from second)
      expect(rows[0].isWarmup).toBe(true);
      expect(rows[1].isWarmup).toBe(true);
      expect(rows[2].isWarmup).toBe(true);
    });

    it('marks last-prescription rows as non-warmup', () => {
      const slot = makeSlot({ prescriptions, isAmrap: false });

      const rows = buildSetRows(slot);

      // Last 3 rows are working sets
      expect(rows[3].isWarmup).toBe(false);
      expect(rows[4].isWarmup).toBe(false);
      expect(rows[5].isWarmup).toBe(false);
    });

    it('uses each prescription.weight as plannedWeight', () => {
      const slot = makeSlot({ prescriptions, isAmrap: false });

      const rows = buildSetRows(slot);

      // Prescription[0] weight=30, sets=2
      expect(rows[0].plannedWeight).toBe(30);
      expect(rows[1].plannedWeight).toBe(30);
      // Prescription[1] weight=42, sets=1
      expect(rows[2].plannedWeight).toBe(42);
      // Prescription[2] weight=60, sets=3
      expect(rows[3].plannedWeight).toBe(60);
      expect(rows[4].plannedWeight).toBe(60);
      expect(rows[5].plannedWeight).toBe(60);
    });

    it('uses each prescription.reps as plannedReps', () => {
      const slot = makeSlot({ prescriptions, isAmrap: false });

      const rows = buildSetRows(slot);

      expect(rows[0].plannedReps).toBe(5);
      expect(rows[1].plannedReps).toBe(5);
      expect(rows[2].plannedReps).toBe(3);
      expect(rows[3].plannedReps).toBe(5);
      expect(rows[4].plannedReps).toBe(5);
      expect(rows[5].plannedReps).toBe(5);
    });
  });

  describe('GPP / bodyweight slots', () => {
    it('sets plannedWeight to undefined for GPP slots', () => {
      const slot = makeSlot({ sets: 3, isGpp: true, weight: 0 });

      const rows = buildSetRows(slot);

      expect(rows.every((r) => r.plannedWeight === undefined)).toBe(true);
    });

    it('sets plannedWeight to undefined for bodyweight slots', () => {
      const slot = makeSlot({ sets: 2, isBodyweight: true, weight: 0 });

      const rows = buildSetRows(slot);

      expect(rows.every((r) => r.plannedWeight === undefined)).toBe(true);
    });

    it('sets plannedWeight to undefined for GPP prescription slots', () => {
      const prescriptions: readonly ResolvedPrescription[] = [
        { percent: 100, reps: 10, sets: 3, weight: 0 },
      ];
      const slot = makeSlot({ prescriptions, isGpp: true });

      const rows = buildSetRows(slot);

      expect(rows.every((r) => r.plannedWeight === undefined)).toBe(true);
    });
  });

  describe('AMRAP slots', () => {
    it('marks only the last row as AMRAP for standard slots', () => {
      const slot = makeSlot({ sets: 3, isAmrap: true });

      const rows = buildSetRows(slot);

      expect(rows[0].isAmrap).toBe(false);
      expect(rows[1].isAmrap).toBe(false);
      expect(rows[2].isAmrap).toBe(true);
    });

    it('marks only the last row as AMRAP for prescription slots', () => {
      const prescriptions: readonly ResolvedPrescription[] = [
        { percent: 50, reps: 5, sets: 1, weight: 30 },
        { percent: 100, reps: 5, sets: 2, weight: 60 },
      ];
      const slot = makeSlot({ prescriptions, isAmrap: true });

      const rows = buildSetRows(slot);

      // 3 rows total: W1, 1, 2 — only the last (index 2) is AMRAP
      expect(rows[0].isAmrap).toBe(false);
      expect(rows[1].isAmrap).toBe(false);
      expect(rows[2].isAmrap).toBe(true);
    });

    it('does not mark any row as AMRAP when slot.isAmrap is false', () => {
      const slot = makeSlot({ sets: 4, isAmrap: false });

      const rows = buildSetRows(slot);

      expect(rows.every((r) => r.isAmrap === false)).toBe(true);
    });
  });
});
