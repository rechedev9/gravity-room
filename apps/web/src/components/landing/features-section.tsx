import { FEATURES } from '@/lib/landing-page-data';
import { FadeUp, StaggerContainer, StaggerItem } from '@/lib/motion-primitives';
import { SECTION_PAD, SectionHeader } from './shared';

export function FeaturesSection(): React.ReactNode {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className={`${SECTION_PAD} max-w-5xl mx-auto`}
    >
      <FadeUp>
        <SectionHeader
          label="Características"
          headingId="features-heading"
          title="Todo lo que Necesitas"
          subtitle="Sin relleno. Solo herramientas enfocadas que hacen que cada repetición cuente."
          subtitleWidth="md"
        />
      </FadeUp>
      <StaggerContainer stagger={0.08} className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-rule">
        {FEATURES.map((f) => (
          <StaggerItem
            key={f.title}
            className="relative bg-card p-8 transition-all landing-card-glow group flex items-start gap-5"
            style={{ borderTop: '2px solid transparent' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderTopColor = 'var(--color-accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderTopColor = 'transparent';
            }}
          >
            <div className="shrink-0 w-16 h-16 group-hover:scale-110 transition-transform duration-300 text-accent">
              {f.icon}
            </div>
            <div>
              <h3 className="text-sm font-bold mb-2 uppercase tracking-wider text-main">
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted">{f.desc}</p>
            </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  );
}
