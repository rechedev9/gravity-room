import { describe, it, expect } from 'vitest';
import {
  setSlotResult,
  removeSlotResult,
  patchSlotField,
  applyUndoEntry,
  buildUndoEntry,
} from './slot-results';
import type { GenericResults } from './types/program';

// ---------------------------------------------------------------------------
// setSlotResult
// ---------------------------------------------------------------------------

describe('setSlotResult', () => {
  it('adds a new result to an empty state', () => {
    const result = setSlotResult({}, 0, 'slot-a', 'success');
    expect(result).toEqual({ '0': { 'slot-a': { result: 'success' } } });
  });

  it('preserves existing workout entries when adding to a different workout', () => {
    const initial: GenericResults = { '0': { 'slot-a': { result: 'success' } } };
    const result = setSlotResult(initial, 1, 'slot-b', 'fail');
    expect(result['0']).toEqual({ 'slot-a': { result: 'success' } });
    expect(result['1']).toEqual({ 'slot-b': { result: 'fail' } });
  });

  it('merges into an existing workout entry without clobbering other slots', () => {
    const initial: GenericResults = { '0': { 'slot-a': { result: 'success' } } };
    const result = setSlotResult(initial, 0, 'slot-b', 'fail');
    expect(result['0']).toEqual({
      'slot-a': { result: 'success' },
      'slot-b': { result: 'fail' },
    });
  });

  it('includes amrapReps when provided', () => {
    const result = setSlotResult({}, 0, 'slot-a', 'success', 8);
    expect(result['0']?.['slot-a']).toEqual({ result: 'success', amrapReps: 8 });
  });

  it('omits amrapReps when not provided', () => {
    const result = setSlotResult({}, 0, 'slot-a', 'success');
    expect(result['0']?.['slot-a']).not.toHaveProperty('amrapReps');
  });

  it('includes setLogs when provided', () => {
    const logs = [{ reps: 5, weight: 100 }] as const;
    const result = setSlotResult({}, 0, 'slot-a', 'success', undefined, logs);
    expect(result['0']?.['slot-a']?.setLogs).toEqual([{ reps: 5, weight: 100 }]);
  });

  it('does not mutate the original state', () => {
    const initial: GenericResults = { '0': { 'slot-a': { result: 'success' } } };
    const frozen = JSON.stringify(initial);
    setSlotResult(initial, 0, 'slot-b', 'fail');
    expect(JSON.stringify(initial)).toBe(frozen);
  });
});

// ---------------------------------------------------------------------------
// removeSlotResult
// ---------------------------------------------------------------------------

describe('removeSlotResult', () => {
  it('removes an existing slot', () => {
    const initial: GenericResults = {
      '0': { 'slot-a': { result: 'success' }, 'slot-b': { result: 'fail' } },
    };
    const result = removeSlotResult(initial, 0, 'slot-a');
    expect(result['0']).toEqual({ 'slot-b': { result: 'fail' } });
  });

  it('removes the workout key entirely when the last slot is removed', () => {
    const initial: GenericResults = { '0': { 'slot-a': { result: 'success' } } };
    const result = removeSlotResult(initial, 0, 'slot-a');
    expect(result).not.toHaveProperty('0');
  });

  it('is a no-op when the workout index does not exist', () => {
    const initial: GenericResults = { '0': { 'slot-a': { result: 'success' } } };
    const result = removeSlotResult(initial, 5, 'slot-a');
    expect(result).toEqual(initial);
  });

  it('is a no-op when the slotId does not exist in the workout', () => {
    const initial: GenericResults = { '0': { 'slot-a': { result: 'success' } } };
    const result = removeSlotResult(initial, 0, 'slot-z');
    expect(result['0']).toEqual({ 'slot-a': { result: 'success' } });
  });

  it('does not mutate the original state', () => {
    const initial: GenericResults = { '0': { 'slot-a': { result: 'success' } } };
    const frozen = JSON.stringify(initial);
    removeSlotResult(initial, 0, 'slot-a');
    expect(JSON.stringify(initial)).toBe(frozen);
  });
});

// ---------------------------------------------------------------------------
// patchSlotField
// ---------------------------------------------------------------------------

describe('patchSlotField', () => {
  it('sets amrapReps on an existing slot', () => {
    const initial: GenericResults = { '0': { 'slot-a': { result: 'success' } } };
    const result = patchSlotField(initial, 0, 'slot-a', 'amrapReps', 10);
    expect(result['0']?.['slot-a']?.amrapReps).toBe(10);
  });

  it('sets rpe on an existing slot', () => {
    const initial: GenericResults = { '0': { 'slot-a': { result: 'success' } } };
    const result = patchSlotField(initial, 0, 'slot-a', 'rpe', 8);
    expect(result['0']?.['slot-a']?.rpe).toBe(8);
  });

  it('removes the field when value is undefined', () => {
    const initial: GenericResults = { '0': { 'slot-a': { result: 'success', amrapReps: 5 } } };
    const result = patchSlotField(initial, 0, 'slot-a', 'amrapReps', undefined);
    expect(result['0']?.['slot-a']).not.toHaveProperty('amrapReps');
  });

  it('preserves other fields on the same slot', () => {
    const initial: GenericResults = { '0': { 'slot-a': { result: 'success', rpe: 7 } } };
    const result = patchSlotField(initial, 0, 'slot-a', 'amrapReps', 3);
    expect(result['0']?.['slot-a']?.result).toBe('success');
    expect(result['0']?.['slot-a']?.rpe).toBe(7);
  });

  it('does not mutate the original state', () => {
    const initial: GenericResults = { '0': { 'slot-a': { result: 'success' } } };
    const frozen = JSON.stringify(initial);
    patchSlotField(initial, 0, 'slot-a', 'amrapReps', 5);
    expect(JSON.stringify(initial)).toBe(frozen);
  });
});

// ---------------------------------------------------------------------------
// applyUndoEntry
// ---------------------------------------------------------------------------

describe('applyUndoEntry', () => {
  it('deletes the slot when the entry has no prev snapshot (first-time result)', () => {
    const initial: GenericResults = { '0': { 'slot-a': { result: 'success' } } };
    const result = applyUndoEntry(initial, { i: 0, slotId: 'slot-a' });
    expect(result).not.toHaveProperty('0');
  });

  it('restores the previous result when overwriting an existing one', () => {
    const initial: GenericResults = { '0': { 'slot-a': { result: 'success' } } };
    const result = applyUndoEntry(initial, { i: 0, slotId: 'slot-a', prev: 'fail' });
    expect(result['0']?.['slot-a']).toEqual({ result: 'fail' });
  });

  it('restores prevAmrapReps and prevSetLogs alongside prev', () => {
    const initial: GenericResults = { '0': { 'slot-a': { result: 'success', amrapReps: 10 } } };
    const result = applyUndoEntry(initial, {
      i: 0,
      slotId: 'slot-a',
      prev: 'success',
      prevAmrapReps: 6,
      prevSetLogs: [{ reps: 5, weight: 80 }],
    });
    expect(result['0']?.['slot-a']).toEqual({
      result: 'success',
      amrapReps: 6,
      setLogs: [{ reps: 5, weight: 80 }],
    });
  });

  it('restores prevRpe', () => {
    const initial: GenericResults = { '0': { 'slot-a': { result: 'success', rpe: 9 } } };
    const result = applyUndoEntry(initial, {
      i: 0,
      slotId: 'slot-a',
      prev: 'success',
      prevRpe: 7,
    });
    expect(result['0']?.['slot-a']?.rpe).toBe(7);
  });

  it('clears stale fields from the overwritten action that are not part of the snapshot', () => {
    const initial: GenericResults = {
      '0': { 'slot-a': { result: 'success', amrapReps: 10, rpe: 9 } },
    };
    const result = applyUndoEntry(initial, { i: 0, slotId: 'slot-a', prev: 'fail' });
    expect(result['0']?.['slot-a']).toEqual({ result: 'fail' });
  });

  it('does not mutate the original state', () => {
    const initial: GenericResults = { '0': { 'slot-a': { result: 'success' } } };
    const frozen = JSON.stringify(initial);
    applyUndoEntry(initial, { i: 0, slotId: 'slot-a', prev: 'fail' });
    expect(JSON.stringify(initial)).toBe(frozen);
  });
});

// ---------------------------------------------------------------------------
// buildUndoEntry
// ---------------------------------------------------------------------------

describe('buildUndoEntry', () => {
  it('has no prev when the slot has no result yet', () => {
    expect(buildUndoEntry({}, 2, 'slot-a')).toEqual({ i: 2, slotId: 'slot-a' });
  });

  it('snapshots result, rpe, amrapReps and setLogs of the current slot', () => {
    const results: GenericResults = {
      '1': {
        'slot-a': {
          result: 'success',
          rpe: 8,
          amrapReps: 5,
          setLogs: [{ reps: 5, weight: 60, rpe: 8 }],
        },
      },
    };
    expect(buildUndoEntry(results, 1, 'slot-a')).toEqual({
      i: 1,
      slotId: 'slot-a',
      prev: 'success',
      prevRpe: 8,
      prevAmrapReps: 5,
      prevSetLogs: [{ reps: 5, weight: 60, rpe: 8 }],
    });
  });

  it('round-trips with applyUndoEntry: record over a result, then undo returns the prior state', () => {
    const before: GenericResults = {
      '0': { 'slot-a': { result: 'fail', amrapReps: 3, rpe: 9 } },
    };
    const entry = buildUndoEntry(before, 0, 'slot-a');
    const after = setSlotResult(before, 0, 'slot-a', 'success', 6);
    expect(applyUndoEntry(after, entry)).toEqual(before);
  });

  it('round-trips a first-time result back to an empty state', () => {
    const entry = buildUndoEntry({}, 0, 'slot-a');
    const after = setSlotResult({}, 0, 'slot-a', 'success');
    expect(applyUndoEntry(after, entry)).toEqual({});
  });
});
