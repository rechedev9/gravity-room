import { describe, expect, it } from 'vitest';
import { buildProgramConfig, defaultConfigValue, type ProgramConfigField } from './program-config';

function weight(min: number, step: number): ProgramConfigField {
  return { key: 'lift', label: 'Lift', type: 'weight', min, step };
}

describe('defaultConfigValue', () => {
  it.each([
    ['starts a 2.5 kg minimum plan at an empty bar, not a bare 2.5 kg', 2.5, 2.5, 20],
    ['starts a zero minimum at eight steps', 0, 5, 40],
    ['never goes below the minimum', 60, 2.5, 60],
    ['keeps a bodyweight style minimum', 30, 0.5, 30],
    ['falls back to 20 when there is no step', 0, 0, 20],
  ])('weight field: %s', (_name, min, step, expected) => {
    expect(defaultConfigValue(weight(min, step))).toBe(expected);
  });

  it('uses the first option for a select field', () => {
    const field: ProgramConfigField = {
      key: 'variant',
      label: 'Variante',
      type: 'select',
      options: [
        { label: 'A', value: 'alpha' },
        { label: 'B', value: 'beta' },
      ],
    };
    expect(defaultConfigValue(field)).toBe('alpha');
  });
});

describe('buildProgramConfig', () => {
  const configFields: ProgramConfigField[] = [
    { key: 'squat', label: 'Sentadilla', type: 'weight', min: 2.5, step: 2.5 },
    { key: 'bench', label: 'Press Banca', type: 'weight', min: 0, step: 2.5 },
    { key: 'unit', label: 'Unit', type: 'select', options: [{ label: 'kg', value: 'kg' }] },
  ];

  it('fills every field with its default', () => {
    expect(buildProgramConfig({ configFields })).toEqual({ squat: 20, bench: 20, unit: 'kg' });
  });

  it('applies overrides to weight fields only and ignores unknown keys', () => {
    expect(buildProgramConfig({ configFields }, { squat: 100, unit: 99, bogus: 1 })).toEqual({
      squat: 100,
      bench: 20,
      unit: 'kg',
    });
  });
});
