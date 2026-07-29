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

  it('classic-light and classic-dark redefine --color-accent away from gold defaults', () => {
    const css = read('styles/globals.css');
    for (const theme of ['classic-light', 'classic-dark'] as const) {
      const block = css.match(
        new RegExp(`html\\[data-theme='${theme}'\\]\\s*\\{([\\s\\S]*?)\\n\\}`)
      );
      expect(block, `${theme} token block`).toBeTruthy();
      const body = block?.[1] ?? '';
      expect(body).toMatch(/--color-accent:\s*oklch\(/);
      // Gold default hue sits near 84; classic skins use cool blues (~265–270)
      expect(body).not.toMatch(/--color-accent:\s*oklch\([^)]*\b84\s*\)/);
    }
  });
});
