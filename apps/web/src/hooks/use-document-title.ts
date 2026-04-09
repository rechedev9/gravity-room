import { useEffect } from 'react';
import { DEFAULT_PAGE_TITLE } from '@/lib/page-title';

/**
 * Sets document.title for the current page and restores the default on unmount.
 * Uses a useEffect because document.title is a cross-cutting browser API that React
 * does not control declaratively.
 */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title;
    return (): void => {
      document.title = DEFAULT_PAGE_TITLE;
    };
  }, [title]);
}
