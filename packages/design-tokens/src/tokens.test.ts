import { describe, expect, it } from 'vitest';
import { renderTokensCss } from './css';
import { colors } from './tokens';

describe('design tokens', () => {
  it('uses plain six digit hex colors that Metro and CSS both accept', () => {
    for (const value of Object.values(colors)) expect(value).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('emits every web variable once', () => {
    const names = [...renderTokensCss().matchAll(/^ {2}(--[\w-]+):/gm)].map((m) => m[1]);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain('--color-body');
    expect(names).toContain('--color-rule-light');
  });
});
