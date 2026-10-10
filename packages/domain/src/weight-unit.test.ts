import { describe, expect, it } from 'vitest';
import { displayToKg, formatWeight, isWeightUnit, kgToDisplay } from './weight-unit';

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

  it('accepts only the two supported units', () => {
    expect(isWeightUnit('kg')).toBe(true);
    expect(isWeightUnit('lbs')).toBe(true);
    expect(isWeightUnit('LBS')).toBe(false);
    expect(isWeightUnit(undefined)).toBe(false);
  });
});
