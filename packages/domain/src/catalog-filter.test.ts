import { describe, expect, it } from 'vitest';
import {
  filterCatalogEntries,
  hasCatalogFilters,
  normalizeSearch,
  pickFeaturedEntry,
} from './catalog-filter';

const entries = [
  { id: 'gzclp', name: 'GZCLP', description: 'Progresión lineal', level: 'beginner' as const },
  { id: 'hexan-ppl', name: 'HeXaN PPL', description: 'Seis días', level: 'intermediate' as const },
  { id: 'nivel-7', name: 'Nivel 7', description: 'Avanzado', level: 'advanced' as const },
];

describe('normalizeSearch', () => {
  it('folds accents and case and trims', () => {
    expect(normalizeSearch('  Progresión ')).toBe('progresion');
  });
});

describe('filterCatalogEntries', () => {
  it('returns everything for an empty query', () => {
    expect(filterCatalogEntries({ entries, query: { search: '', level: 'all' } })).toHaveLength(3);
  });

  it('matches name or description ignoring accents', () => {
    const found = filterCatalogEntries({ entries, query: { search: 'progresion', level: 'all' } });
    expect(found.map((entry) => entry.id)).toEqual(['gzclp']);
  });

  it('combines the level chip with the search text', () => {
    expect(
      filterCatalogEntries({ entries, query: { search: 'nivel', level: 'beginner' } })
    ).toEqual([]);
    expect(
      filterCatalogEntries({ entries, query: { search: 'nivel', level: 'advanced' } })
    ).toHaveLength(1);
  });

  it('searches the text the caller provides', () => {
    const found = filterCatalogEntries({
      entries,
      query: { search: 'six', level: 'all' },
      searchText: (entry) => (entry.id === 'hexan-ppl' ? 'Six days' : entry.name),
    });
    expect(found.map((entry) => entry.id)).toEqual(['hexan-ppl']);
  });
});

describe('pickFeaturedEntry', () => {
  it('features gzclp only while unfiltered', () => {
    expect(pickFeaturedEntry(entries, { search: '', level: 'all' })?.id).toBe('gzclp');
    expect(pickFeaturedEntry(entries, { search: 'x', level: 'all' })).toBeUndefined();
    expect(pickFeaturedEntry(entries, { search: '', level: 'beginner' })).toBeUndefined();
    expect(hasCatalogFilters({ search: ' ', level: 'all' })).toBe(false);
  });
});
