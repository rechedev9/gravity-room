import { FadeUp, StaggerContainer, StaggerItem } from '@/lib/motion-primitives';
import { SECTION_PAD, SectionLabel } from './shared';
import type { ProblemContent } from './content';

interface ProblemSectionProps {
  readonly content: ProblemContent;
}

/* Pain-point icon — simple X mark in a circle */
function PainIcon(): React.ReactNode {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-5 h-5 shrink-0 mt-0.5"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/* Arrow icon for the "before → after" transition */
function ArrowRightIcon(): React.ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-6 h-6 text-accent shrink-0"
      aria-hidden="true"
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* Check icon for the solution card */
function CheckIcon(): React.ReactNode {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-5 h-5 shrink-0 mt-0.5 text-accent"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6.5 10.5l2.5 2.5 4.5-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProblemSection({ content }: ProblemSectionProps): React.ReactNode {
  const { beforeLabel, afterLabel, solutionLabel, solutionItems } = content;

  return (
    <section aria-labelledby="problem-heading" className={`${SECTION_PAD} max-w-5xl mx-auto`}>
      <FadeUp>
        <SectionLabel>{content.sectionLabel}</SectionLabel>
      </FadeUp>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
        {/* ── Left: pain points ── */}
        <FadeUp delay={0.05}>
          <div>
            <p className="font-mono text-xs tracking-[0.18em] uppercase text-accent mb-3">
              {content.eyebrow}
            </p>
            <h2
              id="problem-heading"
              className="font-display leading-tight text-title mb-4"
              style={{ fontSize: 'clamp(28px, 4vw, 48px)', letterSpacing: '0.01em' }}
            >
              {content.title}
            </h2>
            <p className="text-muted leading-relaxed mb-8" style={{ fontSize: '17px' }}>
              {content.body}
            </p>

            <StaggerContainer stagger={0.07} className="space-y-4">
              {content.items.map((item) => (
                <StaggerItem key={item.label} className="flex items-start gap-3 text-muted">
                  <span className="text-[var(--color-fail)]">
                    <PainIcon />
                  </span>
                  <div>
                    <span className="text-base font-semibold text-main block mb-0.5">
                      {item.label}
                    </span>
                    <span className="text-base leading-relaxed">{item.desc}</span>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </FadeUp>

        {/* ── Right: before → after solution card ── */}
        <FadeUp delay={0.18}>
          <div className="bg-card border border-rule p-6 sm:p-8 space-y-6">
            {/* Before → After transition pill */}
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center px-3 py-1 text-xs font-mono tracking-wider bg-fail-bg text-fail border border-fail-ring">
                {beforeLabel}
              </span>
              <ArrowRightIcon />
              <span className="inline-flex items-center px-3 py-1 text-xs font-mono tracking-wider bg-changed text-accent border border-rule-light">
                {afterLabel}
              </span>
            </div>

            {/* Solution label */}
            <div>
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted mb-3">
                {solutionLabel}
              </p>
              <ul className="space-y-3">
                {solutionItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <CheckIcon />
                    <span className="text-base leading-relaxed text-main">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Resolution statement */}
            <div className="pt-4 border-t border-rule">
              <p className="text-base leading-relaxed text-muted italic">{content.resolution}</p>
            </div>

            {/* Problem/solution visual — decorative, placed below text */}
            <div className="overflow-hidden rounded-sm border border-rule mt-2" aria-hidden="true">
              <img
                src="/landing-problem-solution.webp"
                alt=""
                aria-hidden="true"
                width={900}
                height={506}
                className="w-full h-auto object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
