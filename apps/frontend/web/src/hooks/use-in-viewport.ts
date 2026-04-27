import { useCallback, useEffect, useRef, useState } from 'react';

/** Options for the useInViewport hook. */
export interface UseInViewportOptions {
  /** Intersection threshold (0–1). Default: 0. */
  readonly threshold?: number;
  /** Root margin for the IntersectionObserver. Default: '0px'. */
  readonly rootMargin?: string;
  /** When true, stops observing after the first intersection. Default: true. */
  readonly once?: boolean;
}

/**
 * Returns a ref callback and a boolean indicating whether the observed element
 * is (or has been) visible in the viewport.
 *
 * - Falls back to `true` immediately when `IntersectionObserver` is unavailable
 *   (e.g., happy-dom in tests, SSR contexts).
 * - In `once` mode (default), the boolean latches to `true` after the first
 *   intersection and never reverts — subsequent renders always return `true`.
 * - Cleans up the observer on unmount.
 */
export function useInViewport(
  options?: UseInViewportOptions
): readonly [ref: React.RefCallback<HTMLElement>, isInViewport: boolean] {
  const once = options?.once ?? true;
  const threshold = options?.threshold ?? 0;
  const rootMargin = options?.rootMargin ?? '0px';

  // Fallback: if IntersectionObserver is unavailable, return true immediately
  const ioSupported =
    typeof window !== 'undefined' && typeof window.IntersectionObserver !== 'undefined';

  const [isInViewport, setIsInViewport] = useState<boolean>(!ioSupported);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  // Cleanup helper
  useEffect(() => {
    return (): void => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  const refCallback: React.RefCallback<HTMLElement> = useCallback(
    (node: HTMLElement | null) => {
      // Unobserve previous element if any
      if (elementRef.current && observerRef.current) {
        observerRef.current.unobserve(elementRef.current);
      }

      elementRef.current = node;

      if (!node || !ioSupported) return;

      // Create observer lazily
      if (!observerRef.current) {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting) {
                setIsInViewport(true);
                if (once && observerRef.current) {
                  observerRef.current.unobserve(entry.target);
                  observerRef.current.disconnect();
                  observerRef.current = null;
                }
              }
            }
          },
          { threshold, rootMargin }
        );
      }

      observerRef.current.observe(node);
    },
    [ioSupported, once, threshold, rootMargin]
  );

  return [refCallback, isInViewport] as const;
}
