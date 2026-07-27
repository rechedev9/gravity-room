import { formatLocalizedWeight, parseLocalizedWeight } from './localized-weight-input';

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
  ] as const)('formats %s weight %s into parser-compatible text', (language, value, expected) => {
    const formatted = formatLocalizedWeight(value, language);
    expect(formatted).toBe(expected);
    expect(parseLocalizedWeight(formatted, language)).toEqual({ success: true, value });
  });
});
