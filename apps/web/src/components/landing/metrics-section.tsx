import { StaggerContainer, StaggerItem } from '@/lib/motion-primitives';

interface MetricsSectionProps {
  readonly programCount: number;
  readonly minDaysPerWeek: number;
  readonly onlineCount: number | null;
}

export function MetricsSection({
  programCount,
  minDaysPerWeek,
  onlineCount,
}: MetricsSectionProps): React.ReactNode {
  const metrics = [
    {
      value: programCount > 0 ? String(programCount) : '—',
      label: 'Programas Disponibles',
    },
    { value: '100%', label: 'Gratis' },
    {
      value: minDaysPerWeek > 0 ? `Desde ${minDaysPerWeek}` : '—',
      label: 'Días por Semana',
    },
    {
      value: onlineCount !== null ? String(onlineCount) : '—',
      label: 'Online Ahora',
    },
  ];

  return (
    <section aria-label="Métricas del programa" className="px-6 sm:px-10 py-16 sm:py-20 bg-header">
      <StaggerContainer
        stagger={0.12}
        className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-4 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-rule"
      >
        {metrics.map((m) => (
          <StaggerItem key={m.label} className="text-center px-6 sm:px-10 py-5 sm:py-0">
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
