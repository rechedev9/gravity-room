import { describe, it, expect } from 'bun:test';
import { ProgramInstanceMapSchema, GenericResultsSchema } from './instance';

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
