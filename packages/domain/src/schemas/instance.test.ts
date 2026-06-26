import { describe, expect, it } from 'vitest';

import { MAX_PROGRAM_CONFIG_KEYS, ProgramConfigSchema } from './instance';

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
