/**
 * Locale-aware weight formatting — pure function tests for the decimal separator
 * and grouping rules (S9) and the domain-backed lbs conversion.
 */
import { describe, it, expect } from 'vitest';
import { formatLocaleNumber, formatLocaleWeight } from './locale-weight';

describe('formatLocaleNumber', () => {
  it('formats Spanish with dot grouping and comma decimals', () => {
    expect(formatLocaleNumber(10240, 'es')).toBe('10.240');
    expect(formatLocaleNumber(22.5, 'es')).toBe('22,5');
  });

  it('formats English with comma grouping and dot decimals', () => {
    expect(formatLocaleNumber(22.5, 'en')).toBe('22.5');
    expect(formatLocaleNumber(10240, 'en')).toBe('10,240');
  });

  it('caps at two fraction digits', () => {
    expect(formatLocaleNumber(49.605, 'es')).toBe('49,61');
    expect(formatLocaleNumber(49.605, 'en')).toBe('49.61');
  });

  it('accepts region-qualified language tags by their base', () => {
    expect(formatLocaleNumber(10240, 'es-MX')).toBe('10.240');
    expect(formatLocaleNumber(10240, 'en-GB')).toBe('10,240');
  });
});

describe('formatLocaleWeight', () => {
  it('keeps kg weights with the Spanish separator', () => {
    expect(formatLocaleWeight(22.5, 'kg', 'es')).toBe('22,5 kg');
    expect(formatLocaleWeight(10240, 'kg', 'es')).toBe('10.240 kg');
  });

  it('keeps kg weights with the English separator', () => {
    expect(formatLocaleWeight(22.5, 'kg', 'en')).toBe('22.5 kg');
    expect(formatLocaleWeight(10240, 'kg', 'en')).toBe('10,240 kg');
  });

  it('uses the domain lbs rounding and the locale separator', () => {
    expect(formatLocaleWeight(22.5, 'lbs', 'es')).toBe('49,6 lbs');
    expect(formatLocaleWeight(22.5, 'lbs', 'en')).toBe('49.6 lbs');
  });
});
