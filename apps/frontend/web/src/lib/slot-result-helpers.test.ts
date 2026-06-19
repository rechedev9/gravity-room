import { describe, it, expect } from 'bun:test';
import { setSlotResult, removeSlotResult, patchSlotField } from './slot-result-helpers';
import type { GenericResults } from '@gzclp/domain/types/program';

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
