import { useEffect, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useGuest } from '@/contexts/guest-context';
import { useAuth } from '@/contexts/auth-context';
import { trackEvent } from '@/lib/analytics';
import type { HeroContent } from './content';

interface HeroSectionProps {
  readonly content: HeroContent;
}

export function HeroSection({ content }: HeroSectionProps): React.ReactNode {
  const [isTransformationHovered, setTransformationHovered] = useState(false);
  const [isTransformationPinned, setTransformationPinned] = useState(false);
  const [hasRequestedTrainedImage, setHasRequestedTrainedImage] = useState(false);
  const [showAmbientImage, setShowAmbientImage] = useState(false);
  const showTrained = isTransformationHovered || isTransformationPinned;
  const { enterGuestMode } = useGuest();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setShowAmbientImage(true), 1200);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const requestTrainedImage = (): void => {
    setHasRequestedTrainedImage(true);
  };

  const handleGuestStart = (): void => {
    trackEvent('landing_cta_click', { location: 'hero_guest' });
    if (user !== null) {
      void navigate({ to: '/app' });
      return;
    }
    enterGuestMode();
    void navigate({ to: '/app/programs' });
  };

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate min-h-[820px] overflow-hidden border-b border-rule sm:min-h-[850px] lg:min-h-[calc(100svh-108px)]"
    >
      <div
        className="absolute inset-x-0 bottom-0 -z-20 h-[42%] bg-body lg:inset-0 lg:h-auto"
        aria-hidden="true"
      >
        <img
          src="/landing-hero-untrained.webp"
          width={1672}
          height={941}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover object-[82%_center] lg:origin-[75%_center] lg:scale-[1.08] lg:object-contain lg:object-right"
        />
        {hasRequestedTrainedImage && (
          <img
            src="/landing-hero-trained.webp"
            width={1672}
            height={941}
            alt=""
            data-testid="hero-trained-state"
            loading="eager"
            fetchPriority="low"
            decoding="async"
            className={[
              'absolute inset-0 h-full w-full object-cover object-[82%_center] lg:origin-[75%_center] lg:scale-[1.08] lg:object-contain lg:object-right',
              'transition-opacity duration-700 ease-out',
              showTrained ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
          />
        )}
      </div>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-[15] h-[42%] overflow-hidden lg:inset-0 lg:h-auto"
        aria-hidden="true"
      >
        {showAmbientImage && (
          <img
            src="/landing-gravity-chamber.webp"
            width={1672}
            height={941}
            alt=""
            loading="eager"
            fetchPriority="low"
            decoding="async"
            className={[
              'h-full w-full object-cover object-[75%_center] mix-blend-screen lg:object-center',
              'transition-[opacity,transform] duration-1000 ease-out',
              showTrained ? 'scale-[1.015] opacity-25' : 'scale-100 opacity-[0.14]',
            ].join(' ')}
          />
        )}
      </div>

      <div
        className="absolute inset-0 -z-10 hidden lg:block"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(90deg, rgba(7,6,5,0.98) 0%, rgba(7,6,5,0.9) 34%, rgba(7,6,5,0.45) 53%, rgba(7,6,5,0.04) 72%), linear-gradient(180deg, rgba(7,6,5,0.18) 0%, transparent 58%, rgba(7,6,5,0.48) 100%)',
        }}
      />
      <div
        className="absolute inset-0 -z-10 lg:hidden"
        aria-hidden="true"
        style={{
          background:
            'linear-gradient(180deg, rgba(7,6,5,0.99) 0%, rgba(7,6,5,0.94) 42%, rgba(7,6,5,0.34) 62%, rgba(7,6,5,0.42) 100%), linear-gradient(90deg, rgba(7,6,5,0.62) 0%, transparent 100%)',
        }}
      />

      <button
        type="button"
        aria-label={content.transformationControlLabel}
        aria-pressed={isTransformationPinned}
        onPointerEnter={(event) => {
          requestTrainedImage();
          if (event.pointerType !== 'touch') setTransformationHovered(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType !== 'touch') setTransformationHovered(false);
        }}
        onClick={() => {
          requestTrainedImage();
          setTransformationPinned((current) => !current);
        }}
        className="group absolute inset-x-0 bottom-0 z-10 h-[42%] cursor-crosshair focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent lg:inset-y-0 lg:right-0 lg:left-auto lg:h-full lg:w-[52%]"
      >
        <span className="sr-only">{content.transformationControlLabel}</span>
        <span className="absolute right-5 bottom-5 flex max-w-[270px] flex-col items-end gap-2 text-right sm:right-8 sm:bottom-8 lg:right-10 lg:bottom-10">
          <span className="border border-accent/40 bg-body/80 px-3 py-2 font-mono text-[9px] tracking-[0.08em] text-muted uppercase backdrop-blur-sm sm:text-[10px]">
            {content.transformationHint}
          </span>
          <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.08em] uppercase">
            <span className={showTrained ? 'text-muted' : 'text-main'}>
              {content.transformationBefore}
            </span>
            <span className="text-accent" aria-hidden="true">
              →
            </span>
            <span className={showTrained ? 'text-accent' : 'text-muted'}>
              {content.transformationAfter}
            </span>
          </span>
        </span>
      </button>

      <div className="pointer-events-none relative z-20 mx-auto flex min-h-[820px] max-w-7xl items-start px-6 pt-16 pb-[560px] sm:min-h-[850px] sm:px-10 sm:pt-20 sm:pb-[580px] lg:min-h-[calc(100svh-108px)] lg:items-center lg:px-12 lg:py-16">
        <div className="landing-hero-copy pointer-events-auto flex w-full max-w-3xl flex-col items-start text-left lg:w-[56%] lg:max-w-none">
          <div className="landing-hero-item mb-6 inline-flex items-center gap-3 border border-rule-light bg-card/80 px-4 py-2 font-mono">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />
            <span className="text-[10px] font-medium tracking-[0.08em] text-muted uppercase">
              {content.kicker}
            </span>
          </div>

          <h1
            id="hero-heading"
            className="landing-hero-item hero-title-glow mb-6 font-display leading-[0.88] tracking-[0.01em] text-title uppercase"
            style={{ fontSize: 'clamp(52px, 5.4vw, 92px)' }}
          >
            {content.line1}
            <br />
            <span
              className="text-transparent"
              style={{
                // Token-driven — follows gold / classic-light / classic-dark accents.
                backgroundImage:
                  'linear-gradient(90deg, var(--color-accent) 0%, var(--color-accent-hover) 58%, var(--color-accent-deep) 100%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
              }}
            >
              {content.line2}
            </span>
          </h1>

          <p className="landing-hero-item mb-7 max-w-2xl text-base leading-relaxed text-main opacity-85 sm:text-xl">
            {content.subtitle}
          </p>

          <div className="landing-hero-item mb-4 flex flex-col items-start gap-3 sm:flex-row">
            <Link
              to="/login"
              onClick={() => trackEvent('landing_cta_click', { location: 'hero_primary' })}
              className="landing-primary-cta min-w-[220px] border-2 border-btn-ring bg-btn-active px-8 py-4 text-center font-mono text-sm font-bold tracking-widest text-btn-active-text uppercase transition-all duration-300 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-body focus-visible:outline-none"
            >
              {content.primaryCta}
            </Link>
            <button
              type="button"
              onClick={handleGuestStart}
              className="min-w-[220px] border-2 border-rule-light bg-body/50 px-8 py-4 text-center font-mono text-sm font-bold tracking-widest text-main uppercase backdrop-blur-sm transition-all duration-300 hover:border-accent hover:text-title focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-body focus-visible:outline-none"
            >
              {content.secondaryCta}
            </button>
          </div>

          <p className="landing-hero-item mb-6 font-mono text-[11px] tracking-wider text-muted">
            {content.microcopy}
          </p>

          <ul
            className="landing-hero-item flex flex-wrap gap-2 sm:gap-3"
            aria-label={content.proofListAriaLabel}
          >
            {content.proofItems.map((item) => (
              <li
                key={item.label}
                className="inline-flex items-center gap-2 border border-rule-light bg-card/75 px-3 py-1.5 font-mono text-[10px] tracking-wide text-muted backdrop-blur-sm sm:text-[11px]"
              >
                <span className="font-bold text-accent" aria-hidden="true">
                  {item.value}
                </span>
                {item.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
