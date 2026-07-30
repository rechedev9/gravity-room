import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Structural guard: primary accent surfaces must not hard-code gold hex/oklch
 * that ignore classic-light / classic-dark token overrides.
 */
const root = resolve(__dirname, '..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('theme-token surfaces (no hard-coded gold accents)', () => {
  it('hero line2 gradient is driven by accent tokens, not gold hex', () => {
    const hero = read('features/landing/hero-section.tsx');
    expect(hero).toContain('var(--color-accent)');
    expect(hero).toContain('var(--color-accent-hover)');
    expect(hero).toContain('var(--color-accent-deep)');
    expect(hero).not.toMatch(/#f4b91f|#fff0a8|#d8920f/i);
    // No literal hex in any backgroundImage assignment
    expect(hero).not.toMatch(/backgroundImage:\s*[\n\s]*['"`][^'"`]*#/i);
  });

  it('.hatch scarce-signal strip samples --color-accent, not literal gold oklch', () => {
    const css = read('styles/globals.css');
    // Isolate the .hatch rule body (not .hatch-dim)
    const hatchMatch = css.match(/\.hatch\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
    expect(hatchMatch).toBeTruthy();
    const hatchBody = hatchMatch?.[1] ?? '';
    expect(hatchBody).toContain('var(--color-accent)');
    expect(hatchBody).not.toMatch(/oklch\(\s*0\.8\s+0\.145\s+84/);
    expect(hatchBody).not.toMatch(/#f0c040|#d4a843|#c8a84e|#f4b91f/i);
  });

  it('classic-light and classic-dark keep the forged-gold accent family (hue ~80)', () => {
    const css = read('styles/globals.css');
    for (const theme of ['classic-light', 'classic-dark'] as const) {
      const body = extractThemeBlock(css, theme);
      expect(body.length, `${theme} token block`).toBeGreaterThan(0);
      expect(body).toMatch(/--color-accent:\s*oklch\(/);
      // Brand accent is warm gold (hue 70–90). Cool indigo (~265–270) is rejected.
      expect(body).toMatch(/--color-accent:\s*oklch\([^)]*\b8[0-9]\s*\)/);
      expect(body).not.toMatch(/--color-accent:\s*oklch\([^)]*\b2[5-7][0-9]\s*\)/);
    }
  });
});

/** Extract the body of `html[data-theme='…'] { … }` by brace matching. */
function extractThemeBlock(css: string, theme: string): string {
  const marker = `html[data-theme='${theme}']`;
  const start = css.indexOf(marker);
  if (start < 0) return '';
  const open = css.indexOf('{', start);
  if (open < 0) return '';
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return '';
}
