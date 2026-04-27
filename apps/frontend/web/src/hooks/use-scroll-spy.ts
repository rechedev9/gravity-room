import { useEffect, useState } from 'react';

/**
 * Tracks which section is currently in the viewport.
 * Uses IntersectionObserver with a narrow root margin to detect
 * which section occupies the top ~20-25% of the screen.
 */
export function useScrollSpy(sectionIds: readonly string[]): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -75% 0px', threshold: 0 }
    );

    for (const id of sectionIds) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }

    return (): void => {
      observer.disconnect();
    };
  }, [sectionIds]);

  return activeId;
}
