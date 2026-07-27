import { formatLocalizedWeight, parseLocalizedWeight } from './localized-weight-input';
import { MAX_PROGRAM_WEIGHT, MIN_POSITIVE_PROGRAM_WEIGHT } from '@gzclp/domain';

describe('localized weight input', () => {
  it.each([
    ['es', '22,5', 22.5],
    ['en', '22.5', 22.5],
    ['es', '0,25', 0.25],
    ['en', '0.25', 0.25],
  ] as const)('parses %s decimal %s', (language, input, expected) => {
    expect(parseLocalizedWeight(input, language)).toEqual({
      success: true,
      value: expected,
    });
  });

  it.each([
    ['es', '22.5'],
    ['en', '22,5'],
    ['es', '1.000,5'],
    ['en', '1,000.5'],
    ['en', '1e3'],
    ['es', '-2,5'],
    ['en', '22.'],
    ['es', '22,'],
    ['en', '  '],
    ['en', '0.0000001'],
    ['es', '0,0000001'],
    ['en', '1000000000000000000000'],
    ['es', '1000000000000000000000'],
  ] as const)('rejects ambiguous or invalid %s input %s', (language, input) => {
    expect(parseLocalizedWeight(input, language)).toEqual({ success: false });
  });

  it.each([
    ['es', 2.5, '2,5'],
    ['es', 22.5, '22,5'],
    ['es', 1.25, '1,25'],
    ['en', 2.5, '2.5'],
    ['en', 22.5, '22.5'],
    ['en', 1.25, '1.25'],
    ['en', MIN_POSITIVE_PROGRAM_WEIGHT, '0.000001'],
    ['es', MIN_POSITIVE_PROGRAM_WEIGHT, '0,000001'],
    ['en', MAX_PROGRAM_WEIGHT, '1000000000000000'],
    ['es', MAX_PROGRAM_WEIGHT, '1000000000000000'],
  ] as const)('formats %s weight %s into parser-compatible text', (language, value, expected) => {
    const formatted = formatLocalizedWeight(value, language);
    expect(formatted).toBe(expected);
    expect(parseLocalizedWeight(formatted, language)).toEqual({ success: true, value });
  });

  it.each([1e-7, 1e21])('refuses to format unsupported exponential boundary %s', (value) => {
    expect(() => formatLocalizedWeight(value, 'en')).toThrow('outside the supported decimal range');
    expect(() => formatLocalizedWeight(value, 'es')).toThrow('outside the supported decimal range');
  });
});
