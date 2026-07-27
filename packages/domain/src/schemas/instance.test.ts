import { describe, expect, it } from 'vitest';

import {
  GenericProgramDetailSchema,
  MAX_PROGRAM_CONFIG_KEYS,
  ProgramConfigSchema,
} from './instance';

const buildConfig = (count: number): Record<string, number> =>
  Object.fromEntries(Array.from({ length: count }, (_, index) => [`k${index}`, index]));

const DETAIL = {
  id: 'program-a',
  programId: 'gzclp',
  name: 'GZCLP',
  config: { squat: 20 },
  metadata: null,
  results: {},
  undoHistory: [],
  resultTimestamps: {},
  completedDates: {},
  definitionId: null,
  customDefinition: null,
  status: 'active',
  createdAt: '2026-07-27T10:00:00.000Z',
  updatedAt: '2026-07-27T10:00:00.000Z',
};

describe('ProgramConfigSchema key bound', () => {
  it('accepts a config at the key cap', () => {
    expect(ProgramConfigSchema.safeParse(buildConfig(MAX_PROGRAM_CONFIG_KEYS)).success).toBe(true);
  });

  it('rejects a config above the key cap', () => {
    expect(ProgramConfigSchema.safeParse(buildConfig(MAX_PROGRAM_CONFIG_KEYS + 1)).success).toBe(
      false
    );
  });

  it('keeps legacy persisted numeric values readable while new writes use definition validation', () => {
    expect(
      ProgramConfigSchema.safeParse({
        tinyLegacyWeight: 1e-7,
        hugeLegacyWeight: 1e21,
        negativeLegacyWeight: -5,
      }).success
    ).toBe(true);
  });
});

describe('GenericProgramDetailSchema transport boundary', () => {
  it.each([
    { ...DETAIL, config: { squat: null } },
    { ...DETAIL, results: { '0': { squat: { result: 'corrupt' } } } },
    { ...DETAIL, undoHistory: [{ i: -1, slotId: 'squat' }] },
  ])('rejects corrupt operational data instead of replacing it with empty values', (value) => {
    expect(GenericProgramDetailSchema.safeParse(value).success).toBe(false);
  });
});
