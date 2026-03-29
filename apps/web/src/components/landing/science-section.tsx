import { SCIENCE_CARDS } from '@/lib/landing-page-data';
import { FadeUp, StaggerContainer, StaggerItem, scaleUpVariants } from '@/lib/motion-primitives';
import { SectionHeader } from './shared';

export function ScienceSection(): React.ReactNode {
  return (
    <section
      aria-labelledby="smart-training-heading"
      className="px-6 sm:px-10 py-16 sm:py-24 max-w-5xl mx-auto"
    >
      <FadeUp>
        <SectionHeader
          label="La Ciencia"
          headingId="smart-training-heading"
          title="Por Qué el Entrenamiento Inteligente Gana"
          subtitle="La mayoría se estanca porque entrena aleatoriamente. Los programas estructurados con reglas de progresión integradas son cómo realmente te vuelves más fuerte — de forma consistente."
        />
      </FadeUp>
      <StaggerContainer stagger={0.1} className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-rule">
        {SCIENCE_CARDS.map((card) => (
          <StaggerItem
            key={card.title}
            variants={scaleUpVariants}
            className="relative bg-card p-8 text-center landing-card-glow group cursor-default"
          >
            <div className="mb-5 group-hover:scale-110 transition-transform duration-300 text-accent">
              {card.icon}
            </div>
            <div className="text-sm font-bold mb-3 uppercase tracking-wider text-main">
              {card.title}
            </div>
            <p className="text-sm leading-relaxed text-muted">{card.desc}</p>
          </StaggerItem>
        ))}
      </StaggerContainer>
    </section>
  );
}
