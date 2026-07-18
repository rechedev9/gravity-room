import { Link } from '@tanstack/react-router';
import { trackEvent } from '@/lib/analytics';
import { FadeUp, StaggerContainer, StaggerItem } from '@/lib/motion-primitives';
import { SECTION_PAD, SectionLabel } from './shared';
import type { ProblemContent, ProblemExercise } from './content';

interface ProblemSectionProps {
  readonly content: ProblemContent;
}

function PainIcon(): React.ReactNode {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mt-0.5 h-5 w-5 shrink-0"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 7l6 6M13 7l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ArrowRightIcon({
  className = 'h-6 w-6',
}: {
  readonly className?: string;
}): React.ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
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

function TargetIcon(): React.ReactNode {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5 shrink-0 text-accent-deep"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="6" stroke="currentColor" />
      <circle cx="10" cy="10" r="2" stroke="currentColor" />
      <path d="M10 1v3M10 16v3M1 10h3M16 10h3" stroke="currentColor" />
    </svg>
  );
}

function ExerciseRow({
  exercise,
  active,
}: {
  readonly exercise: ProblemExercise;
  readonly active: boolean;
}): React.ReactNode {
  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 border bg-body/70 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_70px_88px] sm:items-center sm:gap-4 sm:px-5 ${
        active ? 'accent-left-gold border-rule-light bg-changed/30' : 'border-rule'
      }`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rule font-mono text-[10px] text-label">
          {exercise.tier}
        </span>
        <span className="truncate text-base font-semibold text-main sm:text-lg">
          {exercise.name}
        </span>
      </div>
      <span className="justify-self-end font-mono text-sm font-semibold text-main sm:justify-self-auto">
        {exercise.prescription}
      </span>
      <span className="col-span-2 justify-self-end font-mono text-lg font-bold text-accent sm:col-span-1 sm:text-xl">
        {exercise.weight}
      </span>
    </li>
  );
}

export function ProblemSection({ content }: ProblemSectionProps): React.ReactNode {
  return (
    <section aria-labelledby="problem-heading" className={`${SECTION_PAD} mx-auto max-w-6xl`}>
      <FadeUp>
        <SectionLabel>{content.sectionLabel}</SectionLabel>
      </FadeUp>

      <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-[0.84fr_1.16fr] lg:gap-14">
        <FadeUp delay={0.05}>
          <div className="lg:py-7">
            <p className="mb-3 font-mono text-xs tracking-[0.18em] text-accent uppercase">
              {content.eyebrow}
            </p>
            <h2
              id="problem-heading"
              className="mb-5 font-display leading-[1.08] text-title"
              style={{ fontSize: 'clamp(36px, 4.2vw, 56px)', letterSpacing: '0.01em' }}
            >
              {content.title}
            </h2>
            <p className="mb-7 max-w-xl text-[17px] leading-relaxed text-muted">{content.body}</p>

            <StaggerContainer stagger={0.07} className="border-b border-rule">
              {content.items.map((item) => (
                <StaggerItem
                  key={item.label}
                  className="flex items-start gap-3 border-t border-rule py-4 text-muted"
                >
                  <span className="text-fail">
                    <PainIcon />
                  </span>
                  <div>
                    <span className="mb-0.5 block text-sm font-semibold text-main">
                      {item.label}
                    </span>
                    <span className="text-sm leading-relaxed">{item.desc}</span>
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </FadeUp>

        <FadeUp delay={0.18}>
          <div className="relative h-full overflow-hidden border border-rule-light bg-card p-3 sm:p-5">
            <div
              className="hatch-dim absolute top-0 right-0 h-20 w-20 opacity-40"
              aria-hidden="true"
            />

            <div className="relative flex h-full flex-col border border-rule bg-header/55 p-4 sm:p-6">
              <div className="mb-5 flex flex-wrap items-center justify-center gap-3 border-b border-rule pb-5 sm:gap-5">
                <span className="border border-fail-ring bg-fail-bg px-3 py-1.5 font-mono text-[11px] tracking-wider text-fail">
                  {content.beforeLabel}
                </span>
                <ArrowRightIcon className="h-5 w-5 text-accent" />
                <span className="border border-accent-deep bg-changed px-3 py-1.5 font-mono text-[11px] font-semibold tracking-wider text-accent">
                  {content.afterLabel}
                </span>
              </div>

              <div className="relative mb-5 flex items-start justify-between gap-4 overflow-hidden">
                <div className="relative z-10">
                  <p className="mb-2 font-mono text-[11px] font-semibold tracking-[0.18em] text-accent uppercase">
                    {content.sessionKicker}
                  </p>
                  <h3 className="font-display text-5xl leading-none tracking-[0.03em] text-title sm:text-6xl">
                    {content.sessionTitle}
                  </h3>
                </div>
                <p className="relative z-10 max-w-28 text-right font-mono text-[9px] leading-relaxed tracking-[0.16em] text-label uppercase sm:text-[10px]">
                  {content.sessionCode}
                </p>
                <span
                  className="pointer-events-none absolute -top-7 right-16 font-display text-[116px] leading-none text-rule/35 select-none"
                  aria-hidden="true"
                >
                  A
                </span>
              </div>

              <ol aria-label={content.workoutAriaLabel} className="mb-5 space-y-2">
                {content.exercises.map((exercise, index) => (
                  <ExerciseRow key={exercise.name} exercise={exercise} active={index === 0} />
                ))}
              </ol>

              <div className="mt-auto">
                <p className="mb-5 flex items-center gap-2 text-sm text-muted">
                  <TargetIcon />
                  {content.calculatedLabel}
                </p>
                <Link
                  to="/login"
                  onClick={() => trackEvent('landing_cta_click', { location: 'problem_session' })}
                  className="landing-primary-cta flex w-full items-center justify-center gap-4 border-2 border-btn-ring bg-btn-active px-6 py-4 text-center font-mono text-sm font-bold tracking-[0.14em] text-btn-active-text uppercase transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-body focus-visible:outline-none"
                >
                  {content.ctaLabel}
                  <ArrowRightIcon className="h-5 w-5" />
                </Link>
                <p className="mt-3 text-center font-mono text-[10px] tracking-wider text-label">
                  {content.closingLabel}
                </p>
              </div>
            </div>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
