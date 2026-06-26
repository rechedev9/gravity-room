import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import en from '@/lib/i18n/locales/en/translation.json';
import es from '@/lib/i18n/locales/es/translation.json';

type JsonObject = Record<string, unknown>;

// import.meta.dir is a Bun-only convenience; derive the directory from the
// module URL so this works under vitest/Node too.
const SOURCE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const STRING_LITERAL_T_CALL = /\bt\(\s*(['"])([^'"\n]+)\1/g;

function flattenKeys(obj: JsonObject, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as JsonObject, fullKey));
      continue;
    }
    keys.push(fullKey);
  }
  return keys;
}

function listSourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'test-results') continue;
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...listSourceFiles(path));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) {
      files.push(path);
    }
  }
  return files;
}

function usedStaticTranslationKeys(): string[] {
  const keys = new Set<string>();
  for (const file of listSourceFiles(SOURCE_ROOT)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(STRING_LITERAL_T_CALL)) {
      keys.add(match[2]);
    }
  }
  return [...keys].sort();
}

describe('i18n integrity', () => {
  it('Spanish and English locales expose the same complete key set', () => {
    const spanishKeys = flattenKeys(es as JsonObject).sort();
    const englishKeys = flattenKeys(en as JsonObject).sort();

    expect(spanishKeys.length).toBeGreaterThan(0);
    expect(englishKeys).toEqual(spanishKeys);
  });

  it('all statically referenced t() keys exist in both locales', () => {
    const localeKeys = new Set(flattenKeys(es as JsonObject));
    const missingKeys = usedStaticTranslationKeys().filter(
      (key) =>
        !localeKeys.has(key) && !localeKeys.has(`${key}_one`) && !localeKeys.has(`${key}_other`)
    );

    expect(missingKeys).toEqual([]);
  });
});
