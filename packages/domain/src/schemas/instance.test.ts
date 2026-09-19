import { describe, expect, it } from 'vitest';

import {
  GenericResultsSchema,
  MAX_REPS,
  MAX_PROGRAM_CONFIG_KEYS,
  MAX_SET_LOG_WEIGHT,
  ProgramConfigSchema,
  SetLogEntryInputSchema,
  SetLogEntrySchema,
} from './instance';

describe('set log weight bound', () => {
  it('accepts the heaviest allowed set weight as input', () => {
    expect(SetLogEntryInputSchema.safeParse({ reps: 1, weight: MAX_SET_LOG_WEIGHT }).success).toBe(
      true
    );
  });

  it('rejects a new set weight above the shared maximum so clients fail before the API does', () => {
    expect(
      SetLogEntryInputSchema.safeParse({ reps: 1, weight: MAX_SET_LOG_WEIGHT + 1 }).success
    ).toBe(false);
  });

  it('still hydrates stored history that carries an oversized weight', () => {
    expect(SetLogEntrySchema.safeParse({ reps: 1, weight: MAX_SET_LOG_WEIGHT + 1 }).success).toBe(
      true
    );
  });
});

const buildConfig = (n: number): Record<string, number> =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, i]));

describe('ProgramConfigSchema key bound', () => {
  it('accepts a config at the key cap', () => {
    expect(ProgramConfigSchema.safeParse(buildConfig(MAX_PROGRAM_CONFIG_KEYS)).success).toBe(true);
  });

  it('rejects a config above the key cap', () => {
    expect(ProgramConfigSchema.safeParse(buildConfig(MAX_PROGRAM_CONFIG_KEYS + 1)).success).toBe(
      false
    );
  });
});

describe('persisted results and shared workout bounds', () => {
  it('preserves results beyond workout 999 for a valid long program', () => {
    const results = {
      999: { squat: { result: 'success' } },
      1000: { squat: { result: 'fail' } },
      1999: { squat: { result: 'success', amrapReps: MAX_REPS } },
    };
    expect(GenericResultsSchema.parse(results)).toEqual(results);
  });

  it.each(['-1', '2000', '1.5', 'invalid', '123456789'])(
    'rejects out-of-contract workout key %s',
    (key) => {
      expect(
        GenericResultsSchema.safeParse({ [key]: { squat: { result: 'success' } } }).success
      ).toBe(false);
    }
  );
});
