import { STEPS } from '@/lib/landing-page-data';
import { FadeUp, StaggerContainer, StaggerItem, fadeUpVariants } from '@/lib/motion-primitives';
import { SECTION_PAD, SectionHeader } from './shared';

export function HowItWorksSection(): React.ReactNode {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className={`${SECTION_PAD} bg-header`}
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

        {/* Timeline connector (desktop only) */}
        <div className="hidden sm:block relative mb-10">
          <div
            className="absolute top-4 left-[16.67%] right-[16.67%] h-px"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, var(--color-accent) 20%, var(--color-accent) 80%, transparent 100%)',
              opacity: 0.3,
            }}
          />
          <div className="grid grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.num} className="flex justify-center">
                <div className="w-8 h-8 rounded-full border-2 border-accent bg-header flex items-center justify-center">
                  <span className="font-mono text-[10px] font-bold text-accent">{s.num}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <StaggerContainer stagger={0.15} className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
          {STEPS.map((s) => (
            <StaggerItem key={s.num} variants={fadeUpVariants} className="relative text-center">
              {/* Mobile step number */}
              <div className="sm:hidden font-display text-4xl font-bold mb-3 text-accent opacity-60">
                {s.num}
              </div>

              <h3 className="text-base font-bold mb-3 uppercase tracking-wide text-main">
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed mb-5 text-muted">{s.desc}</p>

              <blockquote className="landing-quote-glow p-4 text-left">
                <p className="text-sm italic leading-relaxed text-main">{s.quote}</p>
                <cite className="font-mono text-[11px] not-italic block mt-2 text-muted">
                  {s.source}
                </cite>
              </blockquote>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
