import { PROGRAM_LEVELS, type ProgramLevel } from './catalog';

/** Level chips shown above a catalog list, in display order. */
export const CATALOG_LEVEL_FILTERS = ['all', ...PROGRAM_LEVELS] as const;

export type CatalogLevelFilter = (typeof CATALOG_LEVEL_FILTERS)[number];

type FilterableEntry = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly level: ProgramLevel;
};

type CatalogQuery = {
  readonly search: string;
  readonly level: CatalogLevelFilter;
};

/** The program every catalog opens on when no filter is active. */
export const FEATURED_PROGRAM_ID = 'gzclp';

/** Lower-cased, trimmed and accent-folded, so "fuerza" finds "Fuerza" and "progresion" finds "progresión". */
export function normalizeSearch(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLocaleLowerCase();
}

export function hasCatalogFilters(query: CatalogQuery): boolean {
  return query.level !== 'all' || normalizeSearch(query.search) !== '';
}

/**
 * Entries matching the level chip and the search text. `searchText` lets a caller search
 * what the user actually reads (a translated name) instead of the stored name.
 */
export function filterCatalogEntries<T extends FilterableEntry>(options: {
  readonly entries: readonly T[];
  readonly query: CatalogQuery;
  readonly searchText?: (entry: T) => string;
}): T[] {
  const { entries, query, searchText } = options;
  const needle = normalizeSearch(query.search);
  return entries.filter(
    (entry) =>
      (query.level === 'all' || entry.level === query.level) &&
      normalizeSearch(
        searchText ? searchText(entry) : `${entry.name} ${entry.description}`
      ).includes(needle)
  );
}

/** The featured entry, shown only while the list is unfiltered. */
export function pickFeaturedEntry<T extends FilterableEntry>(
  entries: readonly T[],
  query: CatalogQuery
): T | undefined {
  if (hasCatalogFilters(query)) return undefined;
  return entries.find((entry) => entry.id === FEATURED_PROGRAM_ID);
}
