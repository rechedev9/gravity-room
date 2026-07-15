import { FadeUp, StaggerContainer, StaggerItem } from '@/lib/motion-primitives';
import { SECTION_PAD, SectionHeader } from './shared';
import type { HowItWorksContent } from './content';

interface HowItWorksSectionProps {
  readonly content: HowItWorksContent;
}

export function HowItWorksSection({ content }: HowItWorksSectionProps): React.ReactNode {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className={`${SECTION_PAD} bg-header`}
    >
      <div className="max-w-5xl mx-auto">
        <FadeUp>
          <SectionHeader
            label={content.sectionLabel}
            headingId="how-it-works-heading"
            title={content.title}
            subtitle={content.subtitle}
          />
        </FadeUp>

        <StaggerContainer stagger={0.12} className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-rule">
          {content.steps.map((s) => (
            <StaggerItem key={s.num} className="relative bg-card p-6 sm:p-7 text-left">
              <div className="font-display text-4xl font-bold mb-6 text-accent opacity-70">
                {s.num}
              </div>
              <h3 className="text-base font-bold mb-3 uppercase tracking-wide text-main min-h-12">
                {s.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted">{s.desc}</p>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}
