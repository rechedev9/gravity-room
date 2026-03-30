import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { StaggerContainer, StaggerItem } from '@/lib/motion-primitives';
import { useInViewport } from '@/hooks/use-in-viewport';

interface MetricsSectionProps {
  readonly programCount: number;
  readonly minDaysPerWeek: number;
  readonly totalWorkouts: number;
}

interface MetricCell {
  readonly prefix?: string;
  readonly value: string;
  readonly label: string;
}

function useCountUp(target: number, active: boolean, skipAnimation: boolean): number {
  const [current, setCurrent] = useState(0);
  const raf = useRef(0);

  useEffect(() => {
    if (!active || target <= 0) return;
    if (skipAnimation) {
      setCurrent(target);
      return;
    }
    setCurrent(0);
    const duration = 800;
    const start = performance.now();
    const tick = (now: number): void => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) ** 3;
      setCurrent(Math.round(eased * target));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, active, skipAnimation]);

  return active ? current : 0;
}

export function MetricsSection({
  programCount,
  minDaysPerWeek,
  totalWorkouts,
}: MetricsSectionProps): React.ReactNode {
  const [sectionRef, visible] = useInViewport();
  const reduced = useReducedMotion() ?? false;

  const programAnimated = useCountUp(programCount, visible, reduced);
  const workoutsAnimated = useCountUp(totalWorkouts, visible, reduced);

  const metrics: readonly MetricCell[] = [
    {
      value: programCount > 0 ? String(programAnimated) : '—',
      label: 'Programas Disponibles',
    },
    { value: '100%', label: 'Gratis' },
    {
      prefix: 'Desde',
      value: minDaysPerWeek > 0 ? String(minDaysPerWeek) : '—',
      label: 'Días por Semana',
    },
    {
      value: totalWorkouts > 0 ? String(workoutsAnimated) : '—',
      label: 'Entrenamientos',
    },
  ];

  return (
    <section
      ref={sectionRef}
      aria-label="Métricas del programa"
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
              className="font-display hero-number-glow leading-none mb-2 text-title"
              style={{
                fontSize: 'clamp(52px, 7vw, 88px)',
                letterSpacing: '0.02em',
              }}
            >
              {m.value}
            </div>
            <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-muted">
              {m.label}
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  );
}
