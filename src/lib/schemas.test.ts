import { describe, it, expect } from 'bun:test';
import { StartWeightsSchema, ResultsSchema, UndoHistorySchema, ExportDataSchema } from './schemas';
import { DEFAULT_WEIGHTS } from '../../test/helpers/fixtures';

// ---------------------------------------------------------------------------
// StartWeightsSchema — validates the 6-exercise weight config
// ---------------------------------------------------------------------------
describe('StartWeightsSchema', () => {
  it('should accept valid start weights', () => {
    const result = StartWeightsSchema.safeParse(DEFAULT_WEIGHTS);
    expect(result.success).toBe(true);
  });

  it('should accept minimum weights (2.5 each)', () => {
    const min = { squat: 2.5, bench: 2.5, deadlift: 2.5, ohp: 2.5, latpulldown: 2.5, dbrow: 2.5 };
    expect(StartWeightsSchema.safeParse(min).success).toBe(true);
  });

  it('should reject weights below 2.5', () => {
    const below = { ...DEFAULT_WEIGHTS, squat: 2 };
    expect(StartWeightsSchema.safeParse(below).success).toBe(false);
  });

  it('should reject missing exercises', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { dbrow: _, ...missing } = DEFAULT_WEIGHTS;
    expect(StartWeightsSchema.safeParse(missing).success).toBe(false);
  });

  it('should reject extra fields (strict object)', () => {
    const extra = { ...DEFAULT_WEIGHTS, bicepCurl: 20 };
    expect(StartWeightsSchema.safeParse(extra).success).toBe(false);
  });

  it('should reject non-number values', () => {
    const bad = { ...DEFAULT_WEIGHTS, squat: 'heavy' };
    expect(StartWeightsSchema.safeParse(bad).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ResultsSchema — sparse record of workout results
// ---------------------------------------------------------------------------
describe('ResultsSchema', () => {
  it('should accept empty results', () => {
    expect(ResultsSchema.safeParse({}).success).toBe(true);
  });

  it('should accept valid workout results', () => {
    const results = {
      '0': { t1: 'success', t2: 'fail', t3: 'success' },
      '5': { t1: 'fail' },
      '89': { t1: 'success', t1Reps: 8, t3Reps: 30 },
    };
    expect(ResultsSchema.safeParse(results).success).toBe(true);
  });

  it('should reject invalid result values', () => {
    const bad = { '0': { t1: 'maybe' } };
    expect(ResultsSchema.safeParse(bad).success).toBe(false);
  });

  it('should reject keys that are not 1-2 digit numbers', () => {
    const bad = { abc: { t1: 'success' } };
    expect(ResultsSchema.safeParse(bad).success).toBe(false);
  });

  it('should reject 3+ digit keys', () => {
    const bad = { '100': { t1: 'success' } };
    expect(ResultsSchema.safeParse(bad).success).toBe(false);
  });

  it('should accept AMRAP reps in valid range', () => {
    const valid = { '0': { t1Reps: 0 } };
    expect(ResultsSchema.safeParse(valid).success).toBe(true);

    const max = { '0': { t1Reps: 999 } };
    expect(ResultsSchema.safeParse(max).success).toBe(true);
  });

  it('should reject AMRAP reps out of range', () => {
    const tooHigh = { '0': { t1Reps: 1000 } };
    expect(ResultsSchema.safeParse(tooHigh).success).toBe(false);

    const negative = { '0': { t1Reps: -1 } };
    expect(ResultsSchema.safeParse(negative).success).toBe(false);
  });

  it('should reject extra fields in workout result (strict)', () => {
    const extra = { '0': { t1: 'success', bonus: true } };
    expect(ResultsSchema.safeParse(extra).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// UndoHistorySchema
// ---------------------------------------------------------------------------
describe('UndoHistorySchema', () => {
  it('should accept empty array', () => {
    expect(UndoHistorySchema.safeParse([]).success).toBe(true);
  });

  it('should accept valid undo entries', () => {
    const history = [
      { i: 0, tier: 't1', prev: 'success' },
      { i: 5, tier: 't2' },
      { i: 10, tier: 't3', prev: 'fail' },
    ];
    expect(UndoHistorySchema.safeParse(history).success).toBe(true);
  });

  it('should reject invalid tier values', () => {
    const bad = [{ i: 0, tier: 't4' }];
    expect(UndoHistorySchema.safeParse(bad).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ExportDataSchema
// ---------------------------------------------------------------------------
describe('ExportDataSchema', () => {
  it('should accept valid export data', () => {
    const data = {
      version: 3,
      exportDate: '2025-01-15T10:00:00.000Z',
      results: {},
      startWeights: DEFAULT_WEIGHTS,
      undoHistory: [],
    };
    expect(ExportDataSchema.safeParse(data).success).toBe(true);
  });

  it('should reject missing version', () => {
    const bad = {
      exportDate: '2025-01-15T10:00:00.000Z',
      results: {},
      startWeights: DEFAULT_WEIGHTS,
      undoHistory: [],
    };
    expect(ExportDataSchema.safeParse(bad).success).toBe(false);
  });

  it('should reject missing startWeights', () => {
    const bad = {
      version: 3,
      exportDate: '2025-01-15T10:00:00.000Z',
      results: {},
      undoHistory: [],
    };
    expect(ExportDataSchema.safeParse(bad).success).toBe(false);
  });
});
