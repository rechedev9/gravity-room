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

    // If the page loaded with a hash, reveal all sections immediately
    // so the target section is visible when scrolled to
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

const FEATURES = [
  {
    icon: (
      <svg
        width="28"
        height="28"
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
        width="28"
        height="28"
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
    desc: 'Science-backed training programs with structured periodization. More programs coming soon.',
  },
  {
    icon: (
      <svg
        width="28"
        height="28"
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
        width="28"
        height="28"
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
    desc: 'Enter your starting weights for each lift.',
    quote: '"I\'ll surpass my limits right here, right now."',
    source: '— Goku, entering the Hyperbolic Time Chamber',
  },
  {
    num: '02',
    title: 'Follow the Program',
    desc: 'Each workout tells you exactly what to do.',
    quote: '"A year in here is only a day outside. Let\'s make every second count."',
    source: '— Vegeta, Hyperbolic Time Chamber',
  },
  {
    num: '03',
    title: 'Progress Automatically',
    desc: 'Hit your reps and weight goes up. Miss and the program adapts.',
    quote: '"The real training begins when you push past what you think is your limit."',
    source: '— Goku, training Gohan',
  },
] as const;

export function LandingPage(): React.ReactNode {
  const observe = useFadeInOnScroll();

  return (
    <div className="min-h-dvh bg-[var(--bg-body)] overflow-x-hidden">
      {/* ── Nav ─────────────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 sm:px-10 py-4 bg-[var(--bg-header)] border-b border-[var(--border-color)]">
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
            The Real Hiperbolic Time Chamber
          </span>
        </div>
        <Link
          href="/login"
          className="text-xs font-bold text-[var(--btn-text)] border border-[var(--btn-border)] px-4 py-2 hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)] transition-colors"
        >
          Sign In
        </Link>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="relative text-center px-6 pt-20 pb-24 sm:pt-28 sm:pb-32">
        <div className="landing-fade-in landing-visible max-w-2xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-[var(--text-muted)] mb-4">
            100% Free &middot; No Account Required
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--text-header)] leading-[1.1] mb-6">
            Train Smarter.
            <br />
            <span className="text-[var(--text-main)]">Progress Faster.</span>
          </h1>
          <p className="text-base sm:text-lg text-[var(--text-muted)] max-w-lg mx-auto mb-10 leading-relaxed">
            Stop guessing in the gym. Follow proven programs that auto-adjust weight, sets, and reps
            — so every session moves you forward.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/app"
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
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] pointer-events-none opacity-[0.07]"
          style={{
            background:
              'radial-gradient(ellipse at center, var(--fill-progress) 0%, transparent 70%)',
          }}
        />
      </section>

      {/* ── Features ────────────────────────────────────── */}
      <section
        ref={observe}
        className="landing-fade-in px-6 sm:px-10 py-16 sm:py-24 max-w-5xl mx-auto"
      >
        <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-[var(--text-header)] mb-4">
          Everything You Need
        </h2>
        <p className="text-center text-sm text-[var(--text-muted)] mb-12 max-w-md mx-auto">
          No fluff. Just focused tools that make every rep count.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-[var(--bg-card)] border border-[var(--border-color)] p-6 hover:border-[var(--border-light)] transition-colors group"
            >
              <div className="text-[var(--text-header)] mb-4 group-hover:scale-110 transition-transform origin-left">
                {f.icon}
              </div>
              <h3 className="text-sm font-bold text-[var(--text-main)] mb-2">{f.title}</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────── */}
      <section
        id="how-it-works"
        ref={observe}
        className="landing-fade-in px-6 sm:px-10 py-16 sm:py-24 bg-[var(--bg-header)]"
      >
        <div className="max-w-3xl mx-auto">
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-[var(--text-header)] mb-12">
            Three Steps. That&apos;s It.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-12">
            {STEPS.map((s) => (
              <div key={s.num} className="text-center sm:text-left">
                <span className="text-3xl font-extrabold text-[var(--fill-progress)] opacity-30 block mb-2">
                  {s.num}
                </span>
                <h3 className="text-sm font-bold text-[var(--text-main)] mb-2">{s.title}</h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-3">{s.desc}</p>
                <blockquote className="border-l-2 border-[var(--fill-progress)] pl-3 opacity-60">
                  <p className="text-[11px] italic text-[var(--text-main)] leading-relaxed">
                    {s.quote}
                  </p>
                  <cite className="text-[10px] text-[var(--text-muted)] not-italic block mt-1">
                    {s.source}
                  </cite>
                </blockquote>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Why Smart Training ──────────────────────────── */}
      <section
        ref={observe}
        className="landing-fade-in px-6 sm:px-10 py-16 sm:py-24 max-w-3xl mx-auto"
      >
        <h2 className="text-center text-2xl sm:text-3xl font-extrabold text-[var(--text-header)] mb-4">
          Why Smart Training Wins
        </h2>
        <p className="text-center text-sm text-[var(--text-muted)] mb-10 max-w-lg mx-auto leading-relaxed">
          Most people stall because they train randomly. Structured programs with built-in
          progression rules are how you actually get stronger — consistently.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-5 text-center">
            <div className="text-2xl font-extrabold text-[var(--text-header)] mb-1">
              <svg
                width="28"
                height="28"
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
            <div className="text-xs font-bold text-[var(--text-main)] mb-1 mt-2">
              Progressive Overload
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Weight goes up when you&apos;re ready. Not before, not after. The program decides.
            </p>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-5 text-center">
            <div className="text-2xl font-extrabold text-[var(--stage-s2)] mb-1">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="mx-auto"
              >
                <path d="M12 20V10M18 20V4M6 20v-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-xs font-bold text-[var(--text-main)] mb-1 mt-2">
              Failure Management
            </div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Missed a lift? The program adapts — adjusting volume and intensity to keep you
              progressing.
            </p>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-5 text-center">
            <div className="text-2xl font-extrabold text-[var(--stage-s3)] mb-1">
              <svg
                width="28"
                height="28"
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
            <div className="text-xs font-bold text-[var(--text-main)] mb-1 mt-2">Zero Thinking</div>
            <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
              Walk into the gym knowing exactly what to do. No planning, no spreadsheets, no wasted
              time.
            </p>
          </div>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────── */}
      <section
        ref={observe}
        className="landing-fade-in px-6 sm:px-10 py-16 sm:py-24 bg-[var(--bg-header)] text-center"
      >
        <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--text-header)] mb-3">
          Ready to Start?
        </h2>
        <p className="text-sm text-[var(--text-muted)] mb-8 max-w-md mx-auto">
          No sign-up. No payment. Just open the app and start lifting.
        </p>
        <Link
          href="/app"
          className="inline-block px-10 py-4 text-sm font-bold border-2 border-[var(--btn-border)] bg-[var(--btn-hover-bg)] text-[var(--btn-hover-text)] hover:opacity-90 transition-all"
        >
          Start Training
        </Link>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="px-6 sm:px-10 py-8 border-t border-[var(--border-color)] text-center">
        <p className="text-[11px] text-[var(--text-muted)]">
          Built by RSN &middot; The Real Hiperbolic Time Chamber
        </p>
      </footer>
    </div>
  );
}
