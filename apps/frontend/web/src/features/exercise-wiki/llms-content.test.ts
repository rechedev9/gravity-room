import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXERCISE_ARTICLES } from './content/registry';

const publicDir = resolve(import.meta.dirname, '../../../public');

describe('LLM context files', () => {
  const summary = readFileSync(resolve(publicDir, 'llms.txt'), 'utf8');
  const full = readFileSync(resolve(publicDir, 'llms-full.txt'), 'utf8');

  it('identifies canonical sources and freshness', () => {
    expect(summary).toContain('Canonical URL: https://gravityroom.app/llms.txt');
    expect(full).toContain('**Canonical URL**: https://gravityroom.app/llms-full.txt');
    expect(summary).toMatch(/Last updated: \d{4}-\d{2}-\d{2}/);
    expect(full).toMatch(/\*\*Last updated\*\*: \d{4}-\d{2}-\d{2}/);
  });

  it('does not reintroduce retired infrastructure descriptions', () => {
    for (const content of [summary, full]) {
      expect(content).not.toMatch(/FastAPI|Hetzner|Docker Compose|Caddy|Bun-native/);
    }
  });

  it('links every evidence-based exercise guide in both languages', () => {
    for (const article of EXERCISE_ARTICLES) {
      expect(summary).toContain(`https://gravityroom.app/ejercicios/${article.slug.es}`);
      expect(summary).toContain(`https://gravityroom.app/en/exercises/${article.slug.en}`);
      expect(full).toContain(`https://gravityroom.app/ejercicios/${article.slug.es}`);
      expect(full).toContain(`https://gravityroom.app/en/exercises/${article.slug.en}`);
    }
  });
});
