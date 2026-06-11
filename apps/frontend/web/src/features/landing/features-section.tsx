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
    {
      src: '/feature-cloud-sync.webp',
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
      <StaggerContainer stagger={0.08} className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-rule">
        {content.items.map((f, idx) => {
          const icon = FEATURE_ICONS[idx];
          return (
            <StaggerItem
              key={f.title}
              className="relative bg-card p-8 transition-all landing-card-glow group flex items-start gap-5"
              style={{ borderTop: '2px solid transparent' }}
              onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                e.currentTarget.style.borderTopColor = 'var(--color-accent)';
              }}
              onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                e.currentTarget.style.borderTopColor = 'transparent';
              }}
            >
              <div className="shrink-0 w-16 h-16 group-hover:scale-110 transition-transform duration-300 text-accent">
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
              <div>
                <h3 className="text-sm font-bold mb-2 uppercase tracking-wider text-main">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted">{f.desc}</p>
              </div>
            </StaggerItem>
          );
        })}
      </StaggerContainer>
    </section>
  );
}
