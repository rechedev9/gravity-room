import { SCIENCE_CARDS } from '@/lib/landing-page-data';
import { FadeUp, StaggerContainer, StaggerItem, scaleUpVariants } from '@/lib/motion-primitives';
import { SECTION_PAD, SectionLabel } from './shared';

export function ScienceSection(): React.ReactNode {
  return (
    <section
      aria-labelledby="smart-training-heading"
      className={`${SECTION_PAD} max-w-5xl mx-auto`}
    >
      <FadeUp>
        <SectionLabel>La Ciencia</SectionLabel>
      </FadeUp>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
        {/* Left: headline + description */}
        <FadeUp>
          <h2
            id="smart-training-heading"
            className="font-display mb-5 leading-none text-title"
            style={{ fontSize: 'clamp(36px, 5vw, 60px)', letterSpacing: '0.02em' }}
          >
            Por Qué el Entrenamiento Inteligente Gana
          </h2>
          <p className="text-sm leading-relaxed text-muted sm:text-base sm:leading-relaxed">
            La mayoría se estanca porque entrena aleatoriamente. Los programas estructurados con
            reglas de progresión integradas son cómo realmente te vuelves más fuerte — de forma
            consistente.
          </p>
        </FadeUp>

        {/* Right: stacked cards */}
        <StaggerContainer stagger={0.1} className="flex flex-col gap-4">
          {SCIENCE_CARDS.map((card) => (
            <StaggerItem
              key={card.title}
              variants={scaleUpVariants}
              className="relative bg-card border border-rule p-5 landing-card-glow group cursor-default flex items-start gap-4"
            >
              <div className="shrink-0 mt-0.5 group-hover:scale-110 transition-transform duration-300 text-accent">
                {card.icon}
              </div>
              <div>
                <div className="text-sm font-bold mb-1 uppercase tracking-wider text-main">
                  {card.title}
                </div>
                <p className="text-sm leading-relaxed text-muted">{card.desc}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
