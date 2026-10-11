import { describe, expect, it } from 'vitest';
import { displayToKg, formatWeight, isWeightUnit, kgToDisplay } from './weight-unit';

describe('weight unit conversion', () => {
  it('leaves kg untouched and rounds lbs to two decimals', () => {
    expect(kgToDisplay(47.5, 'kg')).toBe(47.5);
    expect(kgToDisplay(60, 'lbs')).toBe(132.28);
    expect(formatWeight(100, 'lbs')).toBe('220.46 lbs');
    expect(formatWeight(100, 'kg')).toBe('100 kg');
  });

  it('gives back the stored kilogram when a displayed lbs value is saved unchanged', () => {
    expect(displayToKg(kgToDisplay(75, 'lbs'), 'lbs')).toBe(75);
    for (let hundredths = 0; hundredths <= 50_000; hundredths++) {
      const kg = hundredths / 100;
      const shown = kgToDisplay(kg, 'lbs');
      expect(displayToKg(shown, 'lbs')).toBe(kg);
      expect(String(shown)).toMatch(/^\d+(\.\d{1,2})?$/);
    }
  });

  it('shows a typed lbs value again within a hundredth of a pound', () => {
    for (const lbs of [45, 95, 135, 225, 315]) {
      expect(Math.abs(kgToDisplay(displayToKg(lbs, 'lbs'), 'lbs') - lbs)).toBeLessThan(0.011);
    }
  });

  it('accepts only the two supported units', () => {
    expect(isWeightUnit('kg')).toBe(true);
    expect(isWeightUnit('lbs')).toBe(true);
    expect(isWeightUnit('LBS')).toBe(false);
    expect(isWeightUnit(undefined)).toBe(false);
  });
});
