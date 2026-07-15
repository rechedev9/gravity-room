import { FadeUp, StaggerContainer, StaggerItem } from '@/lib/motion-primitives';
import { SECTION_PAD, SectionHeader } from './shared';
import type { FeaturesContent } from './content';

interface FeaturesSectionProps {
  readonly content: FeaturesContent;
}

const FEATURE_ICONS: readonly { src: string; width: number; height: number; className?: string }[] =
  [
    {
      src: '/feature-auto-progression.webp',
      width: 64,
      height: 64,
      className: 'w-full h-full object-contain',
    },
    {
      src: '/feature-failure-adjustment.webp',
      width: 64,
      height: 64,
      className: 'w-full h-full object-contain',
    },
    {
      src: '/feature-strength-history.webp',
      width: 64,
      height: 64,
      className: 'w-full h-full object-contain',
    },
  ];

export function FeaturesSection({ content }: FeaturesSectionProps): React.ReactNode {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className={`${SECTION_PAD} max-w-5xl mx-auto`}
    >
      <FadeUp>
        <SectionHeader
          label={content.sectionLabel}
          headingId="features-heading"
          title={content.title}
          subtitle={content.subtitle}
          subtitleWidth="md"
        />
      </FadeUp>
      <StaggerContainer stagger={0.08} className="grid grid-cols-1 md:grid-cols-3 gap-px bg-rule">
        {content.items.map((f, idx) => {
          const icon = FEATURE_ICONS[idx];
          return (
            <StaggerItem
              key={f.title}
              className="relative bg-card p-7 landing-card-glow group text-center"
            >
              <div className="w-14 h-14 mx-auto mb-5 group-hover:scale-110 transition-transform duration-300 text-accent">
                {icon && (
                  <img
                    src={icon.src}
                    alt=""
                    aria-hidden="true"
                    width={icon.width}
                    height={icon.height}
                    className={icon.className}
                  />
                )}
              </div>
              <h3 className="text-base font-bold mb-2 uppercase tracking-wider text-main">
                {f.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted">{f.desc}</p>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </section>
  );
}
