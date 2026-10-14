import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_PAGE_TITLE } from './page-title';
import {
  buildThemeBootScript,
  DEFAULT_THEME,
  RETIRED_DARK_THEME,
  THEME_COLOR_META,
  THEME_COLOR_SCHEME,
  THEME_IDS,
  THEME_STORAGE_KEY,
} from './theme-preference';

describe('theme boot script', () => {
  const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
  const script = buildThemeBootScript();

  it('is injected from the shared theme exports', () => {
    expect(html).toContain('__THEME_BOOT__');
    expect(script).toContain(`'${THEME_STORAGE_KEY}'`);
    for (const id of THEME_IDS) {
      expect(script).toContain(`'${id}'`);
      expect(script).toContain(THEME_COLOR_META[id]);
      expect(script).toContain(THEME_COLOR_SCHEME[id]);
    }
    expect(script).toContain(`'${DEFAULT_THEME}'`);
    expect(script).toContain(`stored === '${RETIRED_DARK_THEME}'`);
    expect(script).toContain('localStorage.setItem(key, theme)');
  });

  it('shares the default document title with index.html', () => {
    expect(html).toContain('__DEFAULT_PAGE_TITLE__');
    expect(html).not.toContain(DEFAULT_PAGE_TITLE);
  });
});
