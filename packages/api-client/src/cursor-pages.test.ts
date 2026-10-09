import { describe, expect, it, vi } from 'vitest';
import { collectCursorPages, type CursorPage } from './cursor-pages';

function pagesFrom(pages: Record<string, CursorPage<number>>, first: CursorPage<number>) {
  return vi.fn(async (cursor: string | undefined) => {
    if (cursor === undefined) return first;
    const page = pages[cursor];
    if (!page) throw new Error(`unexpected cursor ${cursor}`);
    return page;
  });
}

describe('collectCursorPages', () => {
  it('returns a single page without a second request', async () => {
    const fetchPage = pagesFrom({}, { data: [1, 2], nextCursor: null });
    await expect(collectCursorPages({ fetchPage, maxPages: 5 })).resolves.toEqual([1, 2]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });

  it('returns an empty list for an empty first page', async () => {
    const fetchPage = pagesFrom({}, { data: [], nextCursor: null });
    await expect(collectCursorPages({ fetchPage, maxPages: 5 })).resolves.toEqual([]);
  });

  it('follows each cursor in order and concatenates the pages', async () => {
    const fetchPage = pagesFrom(
      { a: { data: [3, 4], nextCursor: 'b' }, b: { data: [5], nextCursor: null } },
      { data: [1, 2], nextCursor: 'a' }
    );
    await expect(collectCursorPages({ fetchPage, maxPages: 5 })).resolves.toEqual([1, 2, 3, 4, 5]);
    expect(fetchPage.mock.calls.map(([cursor]) => cursor)).toEqual([undefined, 'a', 'b']);
  });

  it('throws when the server repeats a cursor', async () => {
    const fetchPage = pagesFrom(
      { a: { data: [2], nextCursor: 'a' } },
      { data: [1], nextCursor: 'a' }
    );
    await expect(collectCursorPages({ fetchPage, maxPages: 5 })).rejects.toThrow(
      'Pagination repeated a cursor'
    );
  });

  it('throws instead of fetching past maxPages', async () => {
    const fetchPage = pagesFrom(
      { a: { data: [2], nextCursor: 'b' }, b: { data: [3], nextCursor: 'c' } },
      { data: [1], nextCursor: 'a' }
    );
    await expect(collectCursorPages({ fetchPage, maxPages: 2 })).rejects.toThrow(
      'Pagination exceeded 2 pages'
    );
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });
});
