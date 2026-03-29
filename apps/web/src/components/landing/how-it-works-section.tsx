import { STEPS } from '@/lib/landing-page-data';
import { FadeUp, StaggerContainer, StaggerItem, fadeUpVariants } from '@/lib/motion-primitives';
import { SectionHeader } from './shared';

export function HowItWorksSection(): React.ReactNode {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="px-6 sm:px-10 py-16 sm:py-24 bg-header"
    >
      <div className="max-w-4xl mx-auto">
        <FadeUp>
          <SectionHeader
            label="Cómo Funciona"
            headingId="how-it-works-heading"
            title="Tres Pasos. Eso es Todo."
            subtitle="Sin configuración complicada. Sin hojas de cálculo. Solo elige tus pesos y entrena."
          />
        </FadeUp>
        <StaggerContainer
          stagger={0.15}
          className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-12"
        >
          {STEPS.map((s) => (
            <StaggerItem key={s.num} variants={fadeUpVariants} className="relative">
              <div
                className="font-display absolute -top-4 -left-2 select-none pointer-events-none text-accent"
                style={{
                  fontSize: '96px',
                  lineHeight: 1,
                  opacity: 0.12,
                  letterSpacing: '0.02em',
                }}
              >
                {s.num}
              </div>
              <div className="relative z-10">
                <div
                  className="font-display text-5xl font-bold mb-3 text-accent"
                  style={{
                    opacity: 0.6,
                    letterSpacing: '0.02em',
                  }}
                >
                  {s.num}
                </div>
                <h3 className="text-base font-bold mb-3 uppercase tracking-wide text-main">
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed mb-5 text-muted">{s.desc}</p>

                <blockquote className="landing-quote-glow p-4">
                  <p className="text-sm italic leading-relaxed text-main">{s.quote}</p>
                  <cite className="font-mono text-[11px] not-italic block mt-2 text-muted">
                    {s.source}
                  </cite>
                </blockquote>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
