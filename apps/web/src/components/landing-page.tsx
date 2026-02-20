import { Link } from 'react-router-dom';
import { FEATURES, STEPS, METRICS, PERSONAS, SCIENCE_CARDS } from '@/lib/landing-page-data';
import { useFadeInOnScroll } from '@/hooks/use-fade-in-on-scroll';
import { useScrollSpy } from '@/hooks/use-scroll-spy';

const SECTION_IDS = ['features', 'how-it-works', 'programs'] as const;

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Programs', href: '#programs' },
] as const;

/* ── Gradient Divider ──────────────────────────── */

function GradientDivider(): React.ReactNode {
  return <div className="landing-gradient-divider" />;
}

/* ── Section label ─────────────────────────────── */

function SectionLabel({ children }: { readonly children: string }): React.ReactNode {
  return <div className="section-label mb-12">{children}</div>;
}

/* ── Main Component ────────────────────────────── */

export function LandingPage(): React.ReactNode {
  const observe = useFadeInOnScroll();
  const activeSection = useScrollSpy(SECTION_IDS);

  return (
    <div className="grain-overlay min-h-dvh bg-[var(--bg-body)] overflow-x-hidden">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-[var(--btn-hover-bg)] focus:text-[var(--btn-hover-text)] focus:text-sm focus:font-bold"
      >
        Skip to content
      </a>

      {/* ── Nav ─────────────────────────────────────────── */}
      <nav
        aria-label="Main navigation"
        className="sticky top-0 z-50 flex items-center justify-between px-6 sm:px-10 py-4 bg-[var(--bg-header)]/95 backdrop-blur-md border-b border-[var(--border-color)]"
      >
        <div className="flex items-center gap-3">
          <img src="/logo.webp" alt="RSN logo" width={32} height={32} className="rounded-full" />
          <span className="text-sm font-bold tracking-tight text-[var(--text-header)]">
            The Real Hyperbolic Time Chamber
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`font-mono text-xs font-semibold tracking-widest uppercase transition-colors duration-200 ${
                activeSection === link.href.slice(1)
                  ? 'text-[var(--text-header)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-header)]'
              }`}
              style={{ fontSize: '11px' }}
            >
              {link.label}
            </a>
          ))}
        </div>
        <Link
          to="/login"
          className="font-mono text-xs font-bold tracking-widest uppercase text-[var(--btn-text)] border border-[var(--btn-border)] px-5 py-2.5 hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)] hover:shadow-[0_0_20px_rgba(232,170,32,0.25)] transition-all duration-200"
        >
          Sign In →
        </Link>
      </nav>

      <main id="main-content">
        {/* ── Hero ────────────────────────────────────────── */}
        <section
          aria-labelledby="hero-heading"
          className="relative px-6 pt-24 pb-20 sm:pt-32 sm:pb-28 overflow-hidden"
        >
          {/* Background glow */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(232,170,32,0.08) 0%, transparent 65%)',
            }}
          />

          {/* Vertical accent lines */}
          <div
            className="absolute left-[8%] top-0 bottom-0 w-px pointer-events-none hidden lg:block"
            style={{
              background:
                'linear-gradient(180deg, transparent 0%, var(--border-color) 30%, var(--border-color) 70%, transparent 100%)',
            }}
          />
          <div
            className="absolute right-[8%] top-0 bottom-0 w-px pointer-events-none hidden lg:block"
            style={{
              background:
                'linear-gradient(180deg, transparent 0%, var(--border-color) 30%, var(--border-color) 70%, transparent 100%)',
            }}
          />

          <div className="landing-fade-in landing-visible max-w-4xl mx-auto text-center">
            {/* Eyebrow */}
            <div className="font-mono inline-flex items-center gap-3 mb-8 px-4 py-2 border border-[var(--border-light)] bg-[var(--bg-card)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--fill-progress)] animate-pulse" />
              <span className="text-[10px] font-medium tracking-[0.3em] uppercase text-[var(--text-muted)]">
                100% Free &middot; Sync Across Devices
              </span>
            </div>

            {/* Main headline — Bebas Neue massive */}
            <h1
              id="hero-heading"
              className="font-display mb-6 leading-none tracking-wide"
              style={{
                fontSize: 'clamp(72px, 12vw, 140px)',
                color: 'var(--text-header)',
                letterSpacing: '0.02em',
              }}
            >
              Train Smarter.
              <br />
              <span style={{ color: 'var(--text-main)', opacity: 0.9 }}>Progress Faster.</span>
            </h1>

            <p
              className="text-base sm:text-lg max-w-xl mx-auto mb-12 leading-relaxed"
              style={{ color: 'var(--text-muted)' }}
            >
              Stop guessing in the gym. Follow proven programs that auto-adjust weight, sets, and
              reps — so every session moves you forward.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/login"
                className="font-mono px-10 py-4 text-sm font-bold tracking-widest uppercase border-2 border-[var(--btn-border)] bg-[var(--btn-hover-bg)] text-[var(--btn-hover-text)] hover:shadow-[0_0_32px_rgba(232,170,32,0.35)] transition-all duration-300 min-w-[220px]"
              >
                Start Training →
              </Link>
              <a
                href="#how-it-works"
                className="font-mono px-10 py-4 text-sm font-bold tracking-widest uppercase border-2 border-[var(--border-color)] text-[var(--text-muted)] hover:border-[var(--border-light)] hover:text-[var(--text-main)] transition-all duration-300 min-w-[220px]"
              >
                How It Works
              </a>
            </div>
          </div>
        </section>

        <GradientDivider />

        {/* ── Metrics Banner ─────────────────────────────── */}
        <section
          aria-label="Program metrics"
          ref={observe}
          className="landing-fade-in px-6 sm:px-10 py-16 sm:py-20 bg-[var(--bg-header)]"
        >
          <div className="max-w-4xl mx-auto grid grid-cols-3 gap-0 divide-x divide-[var(--border-color)]">
            {METRICS.map((m) => (
              <div key={m.label} className="text-center px-6 sm:px-10">
                <div
                  className="font-display hero-number-glow leading-none mb-2"
                  style={{
                    fontSize: 'clamp(52px, 7vw, 88px)',
                    color: 'var(--text-header)',
                    letterSpacing: '0.02em',
                  }}
                >
                  {m.value}
                  {m.suffix && (
                    <span
                      className="text-3xl sm:text-4xl ml-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {m.suffix}
                    </span>
                  )}
                </div>
                <div
                  className="font-mono text-[11px] tracking-[0.2em] uppercase"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        <GradientDivider />

        {/* ── Features ────────────────────────────────────── */}
        <section
          id="features"
          aria-labelledby="features-heading"
          ref={observe}
          className="landing-fade-in px-6 sm:px-10 py-16 sm:py-24 max-w-5xl mx-auto"
        >
          <SectionLabel>Features</SectionLabel>
          <h2
            id="features-heading"
            className="font-display text-center mb-4 leading-none"
            style={{
              fontSize: 'clamp(40px, 6vw, 72px)',
              color: 'var(--text-header)',
              letterSpacing: '0.02em',
            }}
          >
            Everything You Need
          </h2>
          <p
            className="text-center mb-16 max-w-md mx-auto"
            style={{
              fontSize: '15px',
              color: 'var(--text-muted)',
              lineHeight: 1.7,
            }}
          >
            No fluff. Just focused tools that make every rep count.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--border-color)]">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="relative bg-[var(--bg-card)] p-6 transition-all landing-card-glow group"
                style={{ borderTop: '2px solid transparent' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderTopColor = 'var(--fill-progress)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderTopColor = 'transparent';
                }}
              >
                <div
                  className="mb-5 group-hover:scale-110 transition-transform duration-300 origin-left"
                  style={{ color: 'var(--fill-progress)' }}
                >
                  {f.icon}
                </div>
                <h3
                  className="text-sm font-bold mb-2 uppercase tracking-wider"
                  style={{ color: 'var(--text-main)' }}
                >
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {f.desc}
                </p>
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
          <div className="max-w-4xl mx-auto">
            <SectionLabel>How It Works</SectionLabel>
            <h2
              id="how-it-works-heading"
              className="font-display text-center mb-4 leading-none"
              style={{
                fontSize: 'clamp(40px, 6vw, 72px)',
                color: 'var(--text-header)',
                letterSpacing: '0.02em',
              }}
            >
              Three Steps. That&apos;s It.
            </h2>
            <p
              className="text-center mb-16 max-w-lg mx-auto"
              style={{
                fontSize: '15px',
                color: 'var(--text-muted)',
                lineHeight: 1.7,
              }}
            >
              No complicated setup. No spreadsheets. Just pick your weights and go.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-12">
              {STEPS.map((s) => (
                <div key={s.num} className="relative">
                  {/* Giant step number */}
                  <div
                    className="font-display absolute -top-4 -left-2 select-none pointer-events-none"
                    style={{
                      fontSize: '96px',
                      lineHeight: 1,
                      color: 'var(--fill-progress)',
                      opacity: 0.12,
                      letterSpacing: '0.02em',
                    }}
                  >
                    {s.num}
                  </div>
                  <div className="relative z-10">
                    <div
                      className="font-display text-5xl font-bold mb-3"
                      style={{
                        color: 'var(--fill-progress)',
                        opacity: 0.6,
                        letterSpacing: '0.02em',
                      }}
                    >
                      {s.num}
                    </div>
                    <h3
                      className="text-base font-bold mb-3 uppercase tracking-wide"
                      style={{ color: 'var(--text-main)' }}
                    >
                      {s.title}
                    </h3>
                    <p
                      className="text-sm leading-relaxed mb-5"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {s.desc}
                    </p>

                    <blockquote className="landing-quote-glow p-4">
                      <p
                        className="text-sm italic leading-relaxed"
                        style={{ color: 'var(--text-main)' }}
                      >
                        {s.quote}
                      </p>
                      <cite
                        className="font-mono text-[11px] not-italic block mt-2"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {s.source}
                      </cite>
                    </blockquote>
                  </div>
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
          className="landing-fade-in px-6 sm:px-10 py-16 sm:py-24 max-w-5xl mx-auto"
        >
          <SectionLabel>The Science</SectionLabel>
          <h2
            id="smart-training-heading"
            className="font-display text-center mb-4 leading-none"
            style={{
              fontSize: 'clamp(40px, 6vw, 72px)',
              color: 'var(--text-header)',
              letterSpacing: '0.02em',
            }}
          >
            Why Smart Training Wins
          </h2>
          <p
            className="text-center mb-16 max-w-lg mx-auto"
            style={{
              fontSize: '15px',
              color: 'var(--text-muted)',
              lineHeight: 1.7,
            }}
          >
            Most people stall because they train randomly. Structured programs with built-in
            progression rules are how you actually get stronger — consistently.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[var(--border-color)]">
            {SCIENCE_CARDS.map((card) => (
              <div
                key={card.title}
                className="relative bg-[var(--bg-card)] p-8 text-center landing-card-glow group cursor-default"
              >
                <div
                  className="mb-5 group-hover:scale-110 transition-transform duration-300"
                  style={{ color: 'var(--fill-progress)' }}
                >
                  {card.icon}
                </div>
                <div
                  className="text-sm font-bold mb-3 uppercase tracking-wider"
                  style={{ color: 'var(--text-main)' }}
                >
                  {card.title}
                </div>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        <GradientDivider />

        {/* ── Who It's For ───────────────────────────────── */}
        <section
          id="programs"
          aria-labelledby="personas-heading"
          ref={observe}
          className="landing-fade-in px-6 sm:px-10 py-16 sm:py-24 bg-[var(--bg-header)]"
        >
          <div className="max-w-4xl mx-auto">
            <SectionLabel>Built For</SectionLabel>
            <h2
              id="personas-heading"
              className="font-display text-center mb-4 leading-none"
              style={{
                fontSize: 'clamp(40px, 6vw, 72px)',
                color: 'var(--text-header)',
                letterSpacing: '0.02em',
              }}
            >
              Built for Every Lifter
            </h2>
            <p
              className="text-center mb-16 max-w-lg mx-auto"
              style={{
                fontSize: '15px',
                color: 'var(--text-muted)',
                lineHeight: 1.7,
              }}
            >
              Whether you&apos;re touching a barbell for the first time or breaking through a
              plateau.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-[var(--border-color)]">
              {PERSONAS.map((p) => (
                <div
                  key={p.title}
                  className="relative bg-[var(--bg-card)] p-8 text-center landing-card-glow group cursor-default"
                >
                  <div
                    className="mb-5 flex justify-center group-hover:scale-110 transition-transform duration-300"
                    style={{ color: 'var(--fill-progress)' }}
                  >
                    {p.icon}
                  </div>
                  <h3
                    className="text-sm font-bold mb-3 uppercase tracking-wider"
                    style={{ color: 'var(--text-main)' }}
                  >
                    {p.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {p.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <GradientDivider />

        {/* ── Final CTA ───────────────────────────────────── */}
        <section
          ref={observe}
          className="landing-fade-in relative px-6 py-20 sm:py-32 text-center overflow-hidden"
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at center bottom, rgba(232,170,32,0.06) 0%, transparent 60%)',
            }}
          />
          <div className="relative z-10 max-w-2xl mx-auto">
            <p
              className="font-mono text-[11px] tracking-[0.3em] uppercase mb-6"
              style={{ color: 'var(--text-muted)' }}
            >
              Ready to enter the chamber?
            </p>
            <h2
              className="font-display mb-10 leading-none"
              style={{
                fontSize: 'clamp(52px, 8vw, 100px)',
                color: 'var(--text-header)',
                letterSpacing: '0.02em',
              }}
            >
              Enter the Chamber.
              <br />
              <span style={{ color: 'var(--text-main)', opacity: 0.8 }}>Start Training Today.</span>
            </h2>
            <Link
              to="/login"
              className="font-mono inline-block px-12 py-4 text-sm font-bold tracking-widest uppercase border-2 border-[var(--btn-border)] bg-[var(--btn-hover-bg)] text-[var(--btn-hover-text)] hover:shadow-[0_0_48px_rgba(232,170,32,0.4)] transition-all duration-300"
            >
              Start For Free →
            </Link>
          </div>
        </section>
      </main>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="px-6 sm:px-10 py-10 bg-[var(--bg-header)] border-t border-[var(--border-color)]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-header)' }}>
              The Real Hyperbolic Time Chamber
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Built for lifters who refuse to stall.
            </p>
          </div>
          <div
            className="font-mono flex items-center gap-5 text-[11px]"
            style={{ color: 'var(--text-muted)' }}
          >
            <Link to="/privacy" className="hover:text-[var(--text-main)] transition-colors">
              Privacy Policy
            </Link>
            <span aria-hidden="true">&middot;</span>
            <span>Built by RSN</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
