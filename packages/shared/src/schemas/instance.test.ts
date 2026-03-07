import { describe, it, expect } from 'bun:test';
import {
  ProgramInstanceMapSchema,
  GenericResultsSchema,
  SetLogEntrySchema,
  GenericUndoHistorySchema,
} from './instance';
import { ProgressionRuleSchema } from './program-definition';

// ---------------------------------------------------------------------------
// ProgramInstanceMapSchema — validated through real Zod schema
// ---------------------------------------------------------------------------
describe('ProgramInstanceMapSchema', () => {
  it('should accept a valid instance map', () => {
    const map = {
      version: 1,
      activeProgramId: 'test-id',
      instances: {
        'test-id': {
          id: 'test-id',
          programId: 'gzclp',
          name: 'My Program',
          config: { squat: 60, bench: 40, deadlift: 80, ohp: 25, latpulldown: 30, dbrow: 15 },
          results: {},
          undoHistory: [],
          status: 'active',
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        },
      },
    };
    expect(ProgramInstanceMapSchema.safeParse(map).success).toBe(true);
  });

  it('should accept null activeProgramId', () => {
    const map = { version: 1, activeProgramId: null, instances: {} };
    expect(ProgramInstanceMapSchema.safeParse(map).success).toBe(true);
  });

  it('should reject version 0 or negative', () => {
    const bad = { version: 0, activeProgramId: null, instances: {} };
    expect(ProgramInstanceMapSchema.safeParse(bad).success).toBe(false);
  });

  it('should reject invalid status values', () => {
    const bad = {
      version: 1,
      activeProgramId: 'x',
      instances: {
        x: {
          id: 'x',
          programId: 'gzclp',
          name: 'Test',
          config: {},
          results: {},
          undoHistory: [],
          status: 'paused', // invalid
          createdAt: '',
          updatedAt: '',
        },
      },
    };
    expect(ProgramInstanceMapSchema.safeParse(bad).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GenericResultsSchema — slot-keyed results
// ---------------------------------------------------------------------------
describe('GenericResultsSchema', () => {
  it('should accept valid slot-keyed results', () => {
    const results = {
      '0': {
        'd1-t1': { result: 'success', amrapReps: 8 },
        'd1-t2': { result: 'fail' },
        'd1-t3': { result: 'success' },
      },
      '5': {
        'd2-t1': { result: 'fail' },
      },
    };
    expect(GenericResultsSchema.safeParse(results).success).toBe(true);
  });

  it('should accept empty results', () => {
    expect(GenericResultsSchema.safeParse({}).success).toBe(true);
  });

  it('should accept 3-digit workout indices', () => {
    const results = { '100': { 'slot-1': { result: 'success' } } };
    // Keys up to 3 digits are allowed
    expect(GenericResultsSchema.safeParse(results).success).toBe(true);
  });

  it('should reject 4-digit workout indices', () => {
    const results = { '1000': { 'slot-1': { result: 'success' } } };
    expect(GenericResultsSchema.safeParse(results).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SetLogEntrySchema — per-set log entry validation (REQ-DATA-001)
// ---------------------------------------------------------------------------

describe('SetLogEntrySchema', () => {
  it('should accept a valid entry with reps only', () => {
    const entry = { reps: 5 };

    const result = SetLogEntrySchema.safeParse(entry);

    expect(result.success).toBe(true);
  });

  it('should accept a valid entry with all fields', () => {
    const entry = { reps: 8, weight: 60, rpe: 7 };

    const result = SetLogEntrySchema.safeParse(entry);

    expect(result.success).toBe(true);
  });

  it('should accept reps of 0 (minimum boundary)', () => {
    const entry = { reps: 0 };

    const result = SetLogEntrySchema.safeParse(entry);

    expect(result.success).toBe(true);
  });

  it('should accept reps of 999 (maximum boundary)', () => {
    const entry = { reps: 999 };

    const result = SetLogEntrySchema.safeParse(entry);

    expect(result.success).toBe(true);
  });

  it('should reject negative reps', () => {
    const entry = { reps: -1 };

    const result = SetLogEntrySchema.safeParse(entry);

    expect(result.success).toBe(false);
  });

  it('should reject reps above 999', () => {
    const entry = { reps: 1000 };

    const result = SetLogEntrySchema.safeParse(entry);

    expect(result.success).toBe(false);
  });

  it('should reject non-integer reps', () => {
    const entry = { reps: 5.5 };

    const result = SetLogEntrySchema.safeParse(entry);

    expect(result.success).toBe(false);
  });

  it('should reject extra fields (strictObject)', () => {
    const entry = { reps: 5, notes: 'felt easy' };

    const result = SetLogEntrySchema.safeParse(entry);

    expect(result.success).toBe(false);
  });

  it('should reject negative weight', () => {
    const entry = { reps: 5, weight: -10 };

    const result = SetLogEntrySchema.safeParse(entry);

    expect(result.success).toBe(false);
  });

  it('should reject rpe below 1', () => {
    const entry = { reps: 5, rpe: 0 };

    const result = SetLogEntrySchema.safeParse(entry);

    expect(result.success).toBe(false);
  });

  it('should reject rpe above 10', () => {
    const entry = { reps: 5, rpe: 11 };

    const result = SetLogEntrySchema.safeParse(entry);

    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SlotResultSchema — backward compat and setLogs (REQ-DATA-002)
// ---------------------------------------------------------------------------

describe('SlotResultSchema (via GenericResultsSchema)', () => {
  it('should validate without setLogs (backward compat)', () => {
    const results = {
      '0': { 'd1-t1': { result: 'success', amrapReps: 8 } },
    };

    expect(GenericResultsSchema.safeParse(results).success).toBe(true);
  });

  it('should validate with setLogs array', () => {
    const results = {
      '0': {
        'd1-t1': {
          result: 'success',
          setLogs: [{ reps: 5 }, { reps: 5 }, { reps: 5 }],
        },
      },
    };

    expect(GenericResultsSchema.safeParse(results).success).toBe(true);
  });

  it('should validate with empty setLogs array', () => {
    const results = {
      '0': {
        'd1-t1': { setLogs: [] },
      },
    };

    expect(GenericResultsSchema.safeParse(results).success).toBe(true);
  });

  it('should validate with setLogs containing all fields', () => {
    const results = {
      '0': {
        'd1-t1': {
          result: 'success',
          setLogs: [
            { reps: 8, weight: 60, rpe: 7 },
            { reps: 8, weight: 60, rpe: 8 },
          ],
        },
      },
    };

    expect(GenericResultsSchema.safeParse(results).success).toBe(true);
  });

  it('should reject setLogs with invalid entries', () => {
    const results = {
      '0': {
        'd1-t1': {
          result: 'success',
          setLogs: [{ reps: -1 }],
        },
      },
    };

    expect(GenericResultsSchema.safeParse(results).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GenericUndoEntrySchema — prevSetLogs (REQ-DATA-004)
// ---------------------------------------------------------------------------

describe('GenericUndoEntrySchema (via GenericUndoHistorySchema)', () => {
  it('should validate undo entry without prevSetLogs', () => {
    const history = [{ i: 0, slotId: 'd1-t1', prev: 'success' }];

    expect(GenericUndoHistorySchema.safeParse(history).success).toBe(true);
  });

  it('should validate undo entry with prevSetLogs', () => {
    const history = [
      {
        i: 0,
        slotId: 'd1-t1',
        prev: 'success',
        prevSetLogs: [{ reps: 5 }, { reps: 5 }, { reps: 3 }],
      },
    ];

    expect(GenericUndoHistorySchema.safeParse(history).success).toBe(true);
  });

  it('should validate undo entry with empty prevSetLogs array', () => {
    const history = [{ i: 0, slotId: 'd1-t1', prevSetLogs: [] }];

    expect(GenericUndoHistorySchema.safeParse(history).success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DoubleProgressionRuleSchema (via ProgressionRuleSchema) (REQ-DATA-008)
// ---------------------------------------------------------------------------

describe('DoubleProgressionRuleSchema (via ProgressionRuleSchema)', () => {
  it('should accept a valid double_progression rule', () => {
    const rule = {
      type: 'double_progression',
      repRangeTop: 12,
      repRangeBottom: 8,
    };

    const result = ProgressionRuleSchema.safeParse(rule);

    expect(result.success).toBe(true);
  });

  it('should accept repRangeBottom equal to repRangeTop', () => {
    const rule = {
      type: 'double_progression',
      repRangeTop: 10,
      repRangeBottom: 10,
    };

    const result = ProgressionRuleSchema.safeParse(rule);

    expect(result.success).toBe(true);
  });

  it('should reject repRangeBottom greater than repRangeTop', () => {
    const rule = {
      type: 'double_progression',
      repRangeTop: 8,
      repRangeBottom: 12,
    };

    const result = ProgressionRuleSchema.safeParse(rule);

    expect(result.success).toBe(false);
  });

  it('should reject non-positive repRangeTop', () => {
    const rule = {
      type: 'double_progression',
      repRangeTop: 0,
      repRangeBottom: 0,
    };

    const result = ProgressionRuleSchema.safeParse(rule);

    expect(result.success).toBe(false);
  });

  it('should reject non-integer repRangeTop', () => {
    const rule = {
      type: 'double_progression',
      repRangeTop: 12.5,
      repRangeBottom: 8,
    };

    const result = ProgressionRuleSchema.safeParse(rule);

    expect(result.success).toBe(false);
  });
});
