import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { StaggerContainer, StaggerItem } from '@/lib/motion-primitives';
import { useInViewport } from '@/hooks/use-in-viewport';
import type { MetricsContent } from './content';

interface MetricsSectionProps {
  readonly programCount: number;
  readonly minDaysPerWeek: number;
  readonly totalWorkouts: number;
  readonly content: MetricsContent;
}

function useCountUp(target: number, active: boolean, skipAnimation: boolean): number {
  // Seed at 1 so the very first painted frame after the section becomes visible
  // shows "1" climbing, never a literal "0".
  const [current, setCurrent] = useState(1);
  const raf = useRef(0);

  useEffect(() => {
    if (!active || target <= 0) return;
    if (skipAnimation) {
      setCurrent(target);
      return;
    }
    // Start the count-up at 1 (never a literal 0) and climb to the target.
    setCurrent(1);
    const duration = 800;
    const start = performance.now();
    const tick = (now: number): void => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      setCurrent(Math.max(1, Math.round(eased * target)));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, active, skipAnimation]);

  return active ? current : 1;
}

interface MetricCell {
  readonly prefix?: string;
  /** Resolved display value, or `null` while the count is still unknown. */
  readonly value: string | null;
  readonly label: string;
  readonly sub: string;
}

/* Placeholder bar shown in a metric numeral slot while its count is unknown.
 * Keeps the layout stable and never renders a literal "0" before data loads. */
function MetricNumberSkeleton(): React.ReactNode {
  return (
    <span
      className="block mx-auto bg-rule rounded-sm animate-pulse"
      style={{ width: '2.2ch', height: 'clamp(40px, 5.4vw, 68px)' }}
      aria-hidden="true"
    />
  );
}

export function MetricsSection({
  programCount,
  minDaysPerWeek,
  totalWorkouts,
  content,
}: MetricsSectionProps): React.ReactNode {
  const [sectionRef, visible] = useInViewport();
  const reduced = useReducedMotion() ?? false;

  const programAnimated = useCountUp(programCount, visible, reduced);
  const workoutsAnimated = useCountUp(totalWorkouts, visible, reduced);

  // A live metric is "known" once the catalog has resolved (count > 0). Until
  // then - and until the section scrolls into view so the count-up can run from
  // a clean start - the numeral is `null` and a skeleton is rendered instead of
  // a literal "0".
  const metrics: readonly MetricCell[] = [
    {
      value: programCount > 0 && visible ? String(programAnimated) : null,
      label: content.programs.label,
      sub: content.programs.sub,
    },
    { value: '100%', label: content.free.label, sub: content.free.sub },
    {
      prefix: content.days.prefix,
      value: minDaysPerWeek > 0 ? String(minDaysPerWeek) : null,
      label: content.days.label,
      sub: content.days.sub,
    },
    {
      value: totalWorkouts > 0 && visible ? String(workoutsAnimated) : null,
      label: content.workouts.label,
      sub: content.workouts.sub,
    },
  ];

  return (
    <section
      ref={sectionRef}
      aria-label={content.ariaLabel}
      className="px-6 sm:px-10 py-16 sm:py-20 bg-header"
    >
      <StaggerContainer
        stagger={0.12}
        className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-4 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-rule"
      >
        {metrics.map((m) => (
          <StaggerItem key={m.label} className="text-center px-6 sm:px-10 py-5 sm:py-0">
            {m.prefix && (
              <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-muted mb-1">
                {m.prefix}
              </div>
            )}
            <div
              className="font-display hero-number-glow leading-none mb-2 text-title flex items-center justify-center"
              style={{
                fontSize: 'clamp(52px, 7vw, 88px)',
                letterSpacing: '0.02em',
                minHeight: 'clamp(52px, 7vw, 88px)',
              }}
            >
              {m.value === null ? <MetricNumberSkeleton /> : m.value}
            </div>
            <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-muted">
              {m.label}
            </div>
            <div className="mt-1 text-[11px] text-muted/70 leading-snug max-w-[140px] mx-auto">
              {m.sub}
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  );
}
