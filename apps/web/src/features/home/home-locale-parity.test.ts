import { describe, it, expect } from 'bun:test';
import en from '@/lib/i18n/locales/en/translation.json';
import es from '@/lib/i18n/locales/es/translation.json';

type JsonObject = Record<string, unknown>;

function flattenKeys(obj: JsonObject, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flattenKeys(value as JsonObject, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

describe('home locale parity', () => {
  it('en.home and es.home have identical key sets', () => {
    const enHome = (en as JsonObject).home as JsonObject | undefined;
    const esHome = (es as JsonObject).home as JsonObject | undefined;

    // Sanity: keys must be non-empty (guards against trivial [] == [] pass)
    expect(enHome).toBeDefined();
    expect(esHome).toBeDefined();

    const keysEn = flattenKeys(enHome ?? {}).sort();
    const keysEs = flattenKeys(esHome ?? {}).sort();

    expect(keysEn.length).toBeGreaterThan(0);
    expect(keysEs.length).toBeGreaterThan(0);
    expect(keysEn).toEqual(keysEs);
  });
});
