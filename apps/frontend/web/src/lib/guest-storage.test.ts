/**
 * guest-storage.test.ts — unit tests for localStorage guest data helpers.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  GUEST_STORAGE_KEY,
  readGuestData,
  writeGuestData,
  clearGuestData,
  createEmptyGuestMap,
} from './guest-storage';
import type { ProgramInstanceMap } from '@gzclp/domain/types/program';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_MAP: ProgramInstanceMap = {
  version: 1,
  activeProgramId: null,
  instances: {},
};

beforeEach(() => {
  localStorage.clear();
});

// ---------------------------------------------------------------------------
// readGuestData
// ---------------------------------------------------------------------------

describe('readGuestData', () => {
  it('returns null for empty localStorage', () => {
    const result = readGuestData();

    expect(result).toBeNull();
  });

  it('returns null for malformed JSON in localStorage', () => {
    localStorage.setItem(GUEST_STORAGE_KEY, 'not-valid-json{{{');

    const result = readGuestData();

    expect(result).toBeNull();
  });

  it('returns null when Zod validation fails (wrong shape stored)', () => {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify({ unexpected: 'shape' }));

    const result = readGuestData();

    expect(result).toBeNull();
  });

  it('returns the parsed ProgramInstanceMap when valid data is stored', () => {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(VALID_MAP));

    const result = readGuestData();

    expect(result).not.toBeNull();
    expect(result?.version).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// writeGuestData + readGuestData round-trip
// ---------------------------------------------------------------------------

describe('writeGuestData', () => {
  it('returns true on success', () => {
    const success = writeGuestData(VALID_MAP);

    expect(success).toBe(true);
  });

  it('followed by readGuestData returns the same ProgramInstanceMap structure', () => {
    const dataToWrite: ProgramInstanceMap = {
      version: 1,
      activeProgramId: 'some-program',
      instances: {},
    };

    writeGuestData(dataToWrite);
    const readBack = readGuestData();

    expect(readBack?.version).toBe(1);
    expect(readBack?.activeProgramId).toBe('some-program');
  });

  it('round-trips a populated instance including undo history', () => {
    const dataToWrite: ProgramInstanceMap = {
      version: 1,
      activeProgramId: 'guest',
      instances: {
        guest: {
          id: 'guest',
          programId: 'gzclp',
          name: 'GZCLP',
          config: { units: 'kg' },
          results: { '0': { squat: { result: 'success', amrapReps: 5 } } },
          undoHistory: [{ i: 0, slotId: 'squat', prev: 'fail' }],
          status: 'active',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    };

    writeGuestData(dataToWrite);
    const readBack = readGuestData();

    expect(readBack).toEqual(dataToWrite);
  });
});

// ---------------------------------------------------------------------------
// clearGuestData
// ---------------------------------------------------------------------------

describe('clearGuestData', () => {
  it('removes the GUEST_STORAGE_KEY from localStorage', () => {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(VALID_MAP));

    clearGuestData();

    expect(localStorage.getItem(GUEST_STORAGE_KEY)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createEmptyGuestMap
// ---------------------------------------------------------------------------

describe('createEmptyGuestMap', () => {
  it('returns a valid ProgramInstanceMap with version 1 and empty instances', () => {
    const map = createEmptyGuestMap();

    expect(map.version).toBe(1);
    expect(map.activeProgramId).toBeNull();
    expect(map.instances).toEqual({});
  });
});
