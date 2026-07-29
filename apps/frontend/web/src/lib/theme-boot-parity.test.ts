import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, THEME_COLOR_META, THEME_IDS, THEME_STORAGE_KEY } from './theme-preference';

/**
 * The FOUC boot script in index.html cannot import TS — keep it in lockstep
 * with the canonical exports so a rename/meta edit cannot drift silently.
 */
describe('theme boot script parity', () => {
  const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');

  it('embeds the same storage key as THEME_STORAGE_KEY', () => {
    expect(html).toContain(`'${THEME_STORAGE_KEY}'`);
  });

  it('embeds every theme id and the default fallback', () => {
    for (const id of THEME_IDS) {
      expect(html).toContain(`'${id}'`);
    }
    expect(html).toContain(`'${DEFAULT_THEME}'`);
  });

  it('embeds every THEME_COLOR_META accent hex', () => {
    for (const id of THEME_IDS) {
      expect(html).toContain(THEME_COLOR_META[id]);
    }
  });
});
