'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';

function useFadeInOnScroll(): React.RefCallback<HTMLElement> {
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observer.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('landing-visible');
            observer.current?.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -20px 0px' }
    );

    if (window.location.hash) {
      const sections = document.querySelectorAll('.landing-fade-in');
      for (const section of sections) {
        section.classList.add('landing-visible');
      }
    }

    return (): void => {
      observer.current?.disconnect();
    };
  }, []);

  return (el: HTMLElement | null): void => {
    if (el && observer.current) {
      observer.current.observe(el);
    }
  };
}

/* ── Data ──────────────────────────────────────── */

const FEATURES = [
  {
    icon: (
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Smart Progression',
    desc: 'The app decides when to add weight and how to handle failure. You just show up and lift.',
  },
  {
    icon: (
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" />
        <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
      </svg>
    ),
    title: 'Proven Programs',
    desc: 'Science-backed training programs with structured periodization. New programs added regularly.',
  },
  {
    icon: (
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Stats & Charts',
    desc: 'See your strength curve over time. Real data, not guesswork.',
  },
  {
    icon: (
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: 'Offline First',
    desc: 'Works without internet. Your data stays on your device. Optional cloud sync if you want it.',
  },
] as const;

const STEPS = [
  {
    num: '01',
    title: 'Set Your Weights',
    desc: 'Enter your starting weights for each lift. The program builds your entire 90-workout plan instantly.',
    quote: '"I\'ll surpass my limits right here, right now."',
    source: '— Goku, entering the Hyperbolic Time Chamber',
  },
  {
    num: '02',
    title: 'Follow the Program',
    desc: 'Each workout tells you exactly what to do — exercise, sets, reps, weight. No guessing.',
    quote: '"A year in here is only a day outside. Let\'s make every second count."',
    source: '— Vegeta, Hyperbolic Time Chamber',
  },
  {
    num: '03',
    title: 'Progress Automatically',
    desc: 'Hit your reps and weight goes up. Miss and the program adapts — adjusting volume to keep you moving.',
    quote: '"The real training begins when you push past what you think is your limit."',
    source: '— Goku, training Gohan',
  },
] as const;

const METRICS = [
  { value: '90', label: 'Workouts Planned', suffix: '' },
  { value: '6', label: 'Core Lifts Tracked', suffix: '' },
  { value: '3', label: 'Tier System', suffix: 'tiers' },
] as const;

const PERSONAS = [
  {
    icon: (
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M12 2a10 10 0 1 0 10 10" strokeLinecap="round" />
        <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Beginners',
    desc: 'No experience needed. The program tells you exactly what to do every session — just follow along.',
  },
  {
    icon: (
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M6 18L18 6M8 6h10v10" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Intermediate Lifters',
    desc: 'Break through plateaus with structured periodization. The tier system adapts when you stall.',
  },
  {
    icon: (
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          d="M9 12l2 2 4-4M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: 'Program Hoppers',
    desc: 'Stop jumping between programs. Stick with one proven system and watch the numbers climb.',
  },
] as const;

/* ── Gradient Divider ──────────────────────────── */

function GradientDivider(): React.ReactNode {
  return <div className="landing-gradient-divider" />;
}

/* ── Main Component ────────────────────────────── */

export function LandingPage(): React.ReactNode {
  const observe = useFadeInOnScroll();

  return (
    <div className="min-h-dvh bg-[var(--bg-body)] overflow-x-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-[var(--btn-hover-bg)] focus:text-[var(--btn-hover-text)] focus:text-sm focus:font-bold"
      >
        Skip to content
      </a>

      {/* ── Nav ─────────────────────────────────────────── */}
      <nav
        aria-label="Main navigation"
        className="flex items-center justify-between px-6 sm:px-10 py-4 bg-[var(--bg-header)] border-b border-[var(--border-color)]"
      >
        <div className="flex items-center gap-3">
          <Image
            src="/logo.webp"
            alt="RSN logo"
            width={36}
            height={36}
            className="rounded-full"
            priority
          />
          <span className="text-sm font-bold tracking-tight text-[var(--text-header)]">
            The Real Hyperbolic Time Chamber
          </span>
        </div>
        <Link
          href="/login"
          className="text-xs font-bold text-[var(--btn-text)] border border-[var(--btn-border)] px-4 py-2 hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)] transition-colors"
        >
          Sign In
        </Link>
      </nav>

      <main id="main-content">
        {/* ── Hero ────────────────────────────────────────── */}
        <section
          aria-labelledby="hero-heading"
          className="relative text-center px-6 pt-20 pb-16 sm:pt-28 sm:pb-20"
        >
          <div className="landing-fade-in landing-visible max-w-2xl mx-auto">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--text-muted)] mb-4">
              100% Free &middot; Sync Across Devices
            </p>
            <h1
              id="hero-heading"
              aria-label="Train Smarter. Progress Faster."
              className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--text-header)] leading-[1.1] mb-6"
            >
              Train Smarter.
              <br />
              <span className="text-[var(--text-main)]">Progress Faster.</span>
            </h1>
            <p className="text-base sm:text-lg text-[var(--text-muted)] max-w-lg mx-auto mb-10 leading-relaxed">
              Stop guessing in the gym. Follow proven programs that auto-adjust weight, sets, and
              reps — so every session moves you forward.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/login"
                className="px-8 py-3.5 text-sm font-bold border-2 border-[var(--btn-border)] bg-[var(--btn-hover-bg)] text-[var(--btn-hover-text)] hover:opacity-90 transition-all min-w-[200px]"
              >
                Start Training
              </Link>
              <a
                href="#how-it-works"
                className="px-8 py-3.5 text-sm font-bold border-2 border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--border-light)] hover:text-[var(--text-main)] transition-all min-w-[200px]"
              >
                How It Works
              </a>
            </div>
          </div>

          {/* Decorative gradient glow */}
          <div
            className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] pointer-events-none opacity-[0.07]"
            style={{
              background:
                'radial-gradient(ellipse at center, var(--fill-progress) 0%, transparent 70%)',
            }}
          />
        </section>

        <GradientDivider />

        {/* ── Metrics Banner ─────────────────────────────── */}
        <section
          aria-label="Program metrics"
          ref={observe}
          className="landing-fade-in px-6 sm:px-10 py-12 sm:py-16 bg-[var(--bg-header)]"
        >
          <div className="max-w-3xl mx-auto grid grid-cols-3 gap-6 text-center">
            {METRICS.map((m) => (
              <div key={m.label}>
                <div className="text-3xl sm:text-4xl font-extrabold text-[var(--text-header)]">
                  {m.value}
                  {m.suffix && (
                    <span className="text-lg sm:text-xl font-bold text-[var(--text-muted)] ml-1">
                      {m.suffix}
                    </span>
                  )}
                </div>
                <div className="text-xs sm:text-sm text-[var(--text-muted)] mt-1 font-medium">
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        <GradientDivider />

        {/* ── Features ────────────────────────────────────── */}
        <section
          aria-labelledby="features-heading"
          ref={observe}
          className="landing-fade-in px-6 sm:px-10 py-16 sm:py-24 max-w-5xl mx-auto"
        >
          <h2
            id="features-heading"
            className="text-center text-2xl sm:text-3xl font-extrabold text-[var(--text-header)] mb-4"
          >
            Everything You Need
          </h2>
          <p className="text-center text-sm sm:text-base text-[var(--text-muted)] mb-14 max-w-md mx-auto">
            No fluff. Just focused tools that make every rep count.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="relative bg-[var(--bg-card)] border border-[var(--border-color)] p-6 transition-all landing-card-glow group"
              >
                <div className="text-[var(--text-header)] mb-4 group-hover:scale-110 transition-transform origin-left">
                  {f.icon}
                </div>
                <h3 className="text-sm font-bold text-[var(--text-main)] mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <GradientDivider />

        {/* ── How It Works ────────────────────────────────── */}
        <section
          id="how-it-works"
          aria-labelledby="how-it-works-heading"
          ref={observe}
          className="landing-fade-in px-6 sm:px-10 py-16 sm:py-24 bg-[var(--bg-header)]"
        >
          <div className="max-w-3xl mx-auto">
            <h2
              id="how-it-works-heading"
              className="text-center text-2xl sm:text-3xl font-extrabold text-[var(--text-header)] mb-4"
            >
              Three Steps. That&apos;s It.
            </h2>
            <p className="text-center text-sm sm:text-base text-[var(--text-muted)] mb-14 max-w-lg mx-auto">
              No complicated setup. No spreadsheets. Just pick your weights and go.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-10">
              {STEPS.map((s) => (
                <div key={s.num} className="text-center sm:text-left">
                  <span className="text-4xl font-extrabold text-[var(--fill-progress)] opacity-25 block mb-3">
                    {s.num}
                  </span>
                  <h3 className="text-base font-bold text-[var(--text-main)] mb-2">{s.title}</h3>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed mb-4">{s.desc}</p>

                  {/* Anime quote — prominent */}
                  <blockquote className="landing-quote-glow p-3 rounded-sm">
                    <p className="text-sm italic text-[var(--text-main)] leading-relaxed">
                      {s.quote}
                    </p>
                    <cite className="text-xs text-[var(--text-muted)] not-italic block mt-1.5">
                      {s.source}
                    </cite>
                  </blockquote>
                </div>
              ))}
            </div>
          </div>
        </section>

        <GradientDivider />

        {/* ── Why Smart Training ──────────────────────────── */}
        <section
          aria-labelledby="smart-training-heading"
          ref={observe}
          className="landing-fade-in px-6 sm:px-10 py-16 sm:py-24 max-w-4xl mx-auto"
        >
          <h2
            id="smart-training-heading"
            className="text-center text-2xl sm:text-3xl font-extrabold text-[var(--text-header)] mb-4"
          >
            Why Smart Training Wins
          </h2>
          <p className="text-center text-sm sm:text-base text-[var(--text-muted)] mb-12 max-w-lg mx-auto leading-relaxed">
            Most people stall because they train randomly. Structured programs with built-in
            progression rules are how you actually get stronger — consistently.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="relative bg-[var(--bg-card)] border border-[var(--border-color)] p-6 text-center landing-card-glow">
              <div className="text-[var(--text-header)] mb-3">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="mx-auto"
                >
                  <path d="M23 6l-9.5 9.5-5-5L1 18" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M17 6h6v6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="text-sm font-bold text-[var(--text-main)] mb-2">
                Progressive Overload
              </div>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Weight goes up when you&apos;re ready. Not before, not after. The program decides.
              </p>
            </div>
            <div className="relative bg-[var(--bg-card)] border border-[var(--border-color)] p-6 text-center landing-card-glow">
              <div className="text-[var(--text-header)] mb-3">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="mx-auto"
                >
                  <path
                    d="M12 20V10M18 20V4M6 20v-4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div className="text-sm font-bold text-[var(--text-main)] mb-2">
                Failure Management
              </div>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Missed a lift? The program adapts — adjusting volume and intensity to keep you
                progressing.
              </p>
            </div>
            <div className="relative bg-[var(--bg-card)] border border-[var(--border-color)] p-6 text-center landing-card-glow">
              <div className="text-[var(--text-header)] mb-3">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="mx-auto"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="text-sm font-bold text-[var(--text-main)] mb-2">Zero Thinking</div>
              <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                Walk into the gym knowing exactly what to do. No planning, no spreadsheets, no
                wasted time.
              </p>
            </div>
          </div>
        </section>

        <GradientDivider />

        {/* ── Who It's For ───────────────────────────────── */}
        <section
          aria-labelledby="personas-heading"
          ref={observe}
          className="landing-fade-in px-6 sm:px-10 py-16 sm:py-24 bg-[var(--bg-header)]"
        >
          <div className="max-w-4xl mx-auto">
            <h2
              id="personas-heading"
              className="text-center text-2xl sm:text-3xl font-extrabold text-[var(--text-header)] mb-4"
            >
              Built for Every Lifter
            </h2>
            <p className="text-center text-sm sm:text-base text-[var(--text-muted)] mb-12 max-w-lg mx-auto">
              Whether you&apos;re touching a barbell for the first time or breaking through a
              plateau.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {PERSONAS.map((p) => (
                <div
                  key={p.title}
                  className="relative bg-[var(--bg-card)] border border-[var(--border-color)] p-6 text-center landing-card-glow"
                >
                  <div className="text-[var(--text-header)] mb-3 flex justify-center">{p.icon}</div>
                  <h3 className="text-sm font-bold text-[var(--text-main)] mb-2">{p.title}</h3>
                  <p className="text-sm text-[var(--text-muted)] leading-relaxed">{p.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <GradientDivider />

        {/* ── Final CTA ───────────────────────────────────── */}
        <section
          aria-labelledby="cta-heading"
          ref={observe}
          className="landing-fade-in px-6 sm:px-10 py-20 sm:py-28 text-center"
        >
          <h2
            id="cta-heading"
            className="text-2xl sm:text-3xl font-extrabold text-[var(--text-header)] mb-3"
          >
            Ready to Start?
          </h2>
          <p className="text-sm sm:text-base text-[var(--text-muted)] mb-10 max-w-md mx-auto">
            Free forever. Create an account to sync — or jump straight in.
          </p>
          <Link
            href="/login"
            className="inline-block px-10 py-4 text-sm font-bold border-2 border-[var(--btn-border)] bg-[var(--btn-hover-bg)] text-[var(--btn-hover-text)] hover:opacity-90 transition-all"
          >
            Start Training
          </Link>
          <p className="text-sm text-[var(--text-muted)] mt-6 opacity-70">
            No credit card. No spam. Just gains.
          </p>
        </section>

        <GradientDivider />
      </main>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="px-6 sm:px-10 py-10 bg-[var(--bg-header)] text-center">
        <p className="text-sm font-bold text-[var(--text-header)] mb-2">
          The Real Hyperbolic Time Chamber
        </p>
        <p className="text-xs text-[var(--text-muted)] mb-4">
          Built for lifters who refuse to stall.
        </p>
        <div className="flex items-center justify-center gap-4 text-[11px] text-[var(--text-muted)] opacity-60">
          <Link href="/privacy" className="hover:text-[var(--text-main)] transition-colors">
            Privacy Policy
          </Link>
          <span aria-hidden="true">&middot;</span>
          <span>Built by RSN</span>
        </div>
      </footer>
    </div>
  );
}
