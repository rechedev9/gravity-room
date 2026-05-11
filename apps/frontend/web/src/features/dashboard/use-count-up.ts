import { useEffect, useState } from 'react';

interface UseCountUpOptions {
  readonly duration?: number;
}

export function useCountUp(
  target: number | string,
  { duration = 600 }: UseCountUpOptions = {}
): number | string {
  const [display, setDisplay] = useState<number | string>(typeof target === 'number' ? 0 : target);

  useEffect(() => {
    if (typeof target !== 'number') {
      setDisplay(target);
      return;
    }
    if (duration <= 0) {
      setDisplay(target);
      return;
    }
    const start = performance.now();
    const from = 0;
    let raf = 0;

    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // cubic ease-out
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}
