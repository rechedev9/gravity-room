export interface CursorPage<T> {
  readonly data: readonly T[];
  readonly nextCursor: string | null;
}

/**
 * Follows `nextCursor` until the server reports no more pages. A repeated
 * cursor or more than `maxPages` pages means the server is not advancing, so
 * it throws instead of looping.
 */
export async function collectCursorPages<T>(options: {
  readonly fetchPage: (cursor: string | undefined) => Promise<CursorPage<T>>;
  readonly maxPages: number;
}): Promise<T[]> {
  const { fetchPage, maxPages } = options;
  const items: T[] = [];
  const visitedCursors = new Set<string>();
  let cursor: string | undefined;

  for (let pageCount = 0; pageCount < maxPages; pageCount += 1) {
    const page = await fetchPage(cursor);
    items.push(...page.data);

    if (page.nextCursor === null) return items;
    if (visitedCursors.has(page.nextCursor)) {
      throw new Error('Pagination repeated a cursor');
    }
    visitedCursors.add(page.nextCursor);
    cursor = page.nextCursor;
  }

  throw new Error(`Pagination exceeded ${maxPages} pages`);
}
