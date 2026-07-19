import { useEffect, useState } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after `delayMs` have
 * elapsed without a new change. Used to throttle server-side search requests so
 * a query is issued once the user pauses typing rather than on every keystroke.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);

  return debounced;
}
