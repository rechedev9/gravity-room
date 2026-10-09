import { afterEach, describe, expect, it } from 'vitest';
import {
  WEIGHT_UNIT_STORAGE_KEY,
  displayToKg,
  formatWeight,
  kgToDisplay,
  readWeightUnit,
  subscribeWeightUnit,
  writeWeightUnit,
} from './weight-unit';

afterEach(() => {
  localStorage.clear();
});

describe('weight unit conversion', () => {
  it('leaves kg untouched and rounds lbs to one decimal', () => {
    expect(kgToDisplay(47.5, 'kg')).toBe(47.5);
    expect(kgToDisplay(60, 'lbs')).toBe(132.3);
    expect(formatWeight(100, 'lbs')).toBe('220.5 lbs');
    expect(formatWeight(100, 'kg')).toBe('100 kg');
  });

  it('round-trips a typed lbs value back to the same display value', () => {
    for (const lbs of [45, 95, 135, 225, 315]) {
      expect(kgToDisplay(displayToKg(lbs, 'lbs'), 'lbs')).toBe(lbs);
    }
  });
});

describe('weight unit persistence', () => {
  it('defaults to kg and survives a re-read', () => {
    expect(readWeightUnit()).toBe('kg');
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
