import { afterEach, describe, expect, it } from 'vitest';
import {
  WEIGHT_UNIT_STORAGE_KEY,
  readStoredWeightUnit,
  readWeightUnit,
  subscribeWeightUnit,
  writeWeightUnit,
} from './weight-unit';

afterEach(() => {
  localStorage.clear();
});

describe('weight unit persistence', () => {
  it('defaults to kg and survives a re-read', () => {
    expect(readWeightUnit()).toBe('kg');
    expect(readStoredWeightUnit()).toBeNull();
    writeWeightUnit('lbs');
    expect(localStorage.getItem(WEIGHT_UNIT_STORAGE_KEY)).toBe('lbs');
    expect(readWeightUnit()).toBe('lbs');
  });

  it('notifies subscribers in the same tab when the unit changes', () => {
    let calls = 0;
    const unsubscribe = subscribeWeightUnit(() => {
      calls += 1;
    });
    writeWeightUnit('lbs');
    unsubscribe();
    writeWeightUnit('kg');
    expect(calls).toBe(1);
  });
});
