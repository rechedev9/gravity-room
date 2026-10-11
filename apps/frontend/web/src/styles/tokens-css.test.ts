import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderTokensCss } from '@gzclp/design-tokens/css';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '..');

function read(rel: string): string {
  return readFileSync(resolve(root, rel), 'utf8');
}

describe('generated tokens.css', () => {
  it('matches @gzclp/design-tokens (run `pnpm --filter web tokens:css` to refresh)', () => {
    expect(read('styles/tokens.css')).toBe(renderTokensCss());
  });

  it('is imported by globals.css, which no longer hand-writes the dark palette', () => {
    const css = read('styles/globals.css');
    expect(css).toMatch(/@import ['"]\.\/tokens\.css['"];/);
    const themeBlock = /^@theme \{[\s\S]*?^\}/m.exec(css)?.[0] ?? '';
    expect(themeBlock.length).toBeGreaterThan(0);
    for (const name of ['body', 'card', 'surface-2', 'main', 'rule', 'accent', 'ok', 'fail']) {
      expect(themeBlock, `--color-${name} in the web @theme block`).not.toMatch(
        new RegExp(`^ {2}--color-${name}:`, 'm')
      );
    }
  });
});
