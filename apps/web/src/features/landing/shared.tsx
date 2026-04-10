import { Link } from '@tanstack/react-router';
import { motion, useReducedMotion } from 'motion/react';
import { EASE_OUT_EXPO } from '@/lib/motion-primitives';
import type { FooterContent, NavLink } from './content';

/* ── Constants ────────────────────────────────────── */

export const DISCORD_URL = 'https://discord.gg/FXNBrgYf7U';
export const GITHUB_URL = 'https://github.com/rechedev/gravity-room';

export const SECTION_IDS = ['features', 'how-it-works', 'programs'] as const;

export const MAX_LANDING_PROGRAMS = 6;
export const CATALOG_STALE_TIME = 5 * 60 * 1000;
export const SECTION_PAD = 'px-6 sm:px-10 py-14 sm:py-20';

/* ── Gradient Divider ─────────────────────────────── */

export function GradientDivider(): React.ReactNode {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className="landing-gradient-divider"
      initial={reduced ? undefined : { scaleX: 0 }}
      whileInView={reduced ? undefined : { scaleX: 1 }}
      viewport={{ once: true, margin: '0px 0px -10px 0px' }}
      transition={{ duration: 0.9, ease: EASE_OUT_EXPO }}
      style={{ transformOrigin: 'center' }}
    />
  );
}

/* ── Section label ────────────────────────────────── */

export function SectionLabel({ children }: { readonly children: string }): React.ReactNode {
  return <div className="section-label mb-12">{children}</div>;
}

/* ── Section header ───────────────────────────────── */

interface SectionHeaderProps {
  readonly label: string;
  readonly headingId: string;
  readonly title: string;
  readonly subtitle: string;
  readonly subtitleWidth?: 'md' | 'lg';
}

export function SectionHeader({
  label,
  headingId,
  title,
  subtitle,
  subtitleWidth = 'lg',
}: SectionHeaderProps): React.ReactNode {
  return (
    <>
      <SectionLabel>{label}</SectionLabel>
      <h2
        id={headingId}
        className="font-display text-center mb-4 leading-none text-title"
        style={{ fontSize: 'clamp(40px, 6vw, 72px)', letterSpacing: '0.02em' }}
      >
        {title}
      </h2>
      <p
        className={`text-center mb-16 ${subtitleWidth === 'md' ? 'max-w-md' : 'max-w-lg'} mx-auto text-muted`}
        style={{ fontSize: '15px', lineHeight: 1.7 }}
      >
        {subtitle}
      </p>
    </>
  );
}

/* ── Discord icon ─────────────────────────────────── */

export function DiscordIcon({ className }: { readonly className?: string }): React.ReactNode {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.102 18.08.114 18.1.13 18.11a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

/* ── GitHub icon ──────────────────────────────────── */

export function GitHubIcon({ className }: { readonly className?: string }): React.ReactNode {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

/* ── Program helpers ──────────────────────────────── */

export { getCategoryColor, categoryLabel } from '@/lib/category-colors';

export function estimatedWeeks(totalWorkouts: number, workoutsPerWeek: number): number {
  if (workoutsPerWeek <= 0) return 0;
  return Math.ceil(totalWorkouts / workoutsPerWeek);
}

export function ProgramCardSkeleton(): React.ReactNode {
  return (
    <div className="bg-card p-8 animate-pulse">
      <div className="flex justify-center mb-5">
        <div className="w-20 h-5 bg-rule rounded-sm" />
      </div>
      <div className="h-8 bg-rule rounded-sm mx-auto w-2/3 mb-2" />
      <div className="h-3 bg-rule rounded-sm mx-auto w-1/3 mb-5" />
      <div className="space-y-2 mb-6">
        <div className="h-3 bg-rule rounded-sm w-full" />
        <div className="h-3 bg-rule rounded-sm w-4/5 mx-auto" />
      </div>
      <div className="flex justify-center gap-2">
        <div className="h-5 w-16 bg-rule rounded-sm" />
        <div className="h-5 w-20 bg-rule rounded-sm" />
      </div>
    </div>
  );
}

/* ── Skip-navigation link ─────────────────────────── */

export function SkipToContent({ label }: { readonly label: string }): React.ReactNode {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-btn-active focus:text-btn-active-text focus:text-sm focus:font-bold"
    >
      {label}
    </a>
  );
}

/* ── Language switch banner ───────────────────────── */

export function LangBanner({
  label,
  href,
}: {
  readonly label: string;
  readonly href: string;
}): React.ReactNode {
  return (
    <div className="w-full bg-card border-b border-rule text-center py-2 px-4">
      <span className="font-mono text-[11px] tracking-wider text-muted">
        <Link to={href} className="hover:text-accent transition-colors duration-200">
          {label}
        </Link>
      </span>
    </div>
  );
}

/* ── Footer ───────────────────────────────────────── */

interface FooterProps {
  readonly content: FooterContent;
  readonly navLinks: readonly NavLink[];
}

export function Footer({ content, navLinks }: FooterProps): React.ReactNode {
  return (
    <footer className="px-6 sm:px-10 py-12 bg-header border-t border-rule">
      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <img
              src="/logo.webp"
              alt=""
              width={20}
              height={20}
              className="rounded-full"
              aria-hidden="true"
            />
            <p className="text-sm font-bold text-title">Gravity Room</p>
          </div>
          <p className="text-xs text-muted leading-relaxed">{content.tagline}</p>
        </div>

        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted mb-3">
            {content.navLabel}
          </p>
          <ul className="space-y-2">
            {navLinks.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="text-sm text-muted hover:text-main transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted mb-3">
            {content.communityLabel}
          </p>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted hover:text-[#5865F2] transition-colors mb-2"
          >
            <DiscordIcon className="w-4 h-4" />
            Discord
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-muted hover:text-main transition-colors mb-4"
          >
            <GitHubIcon className="w-4 h-4" />
            {content.githubLabel}
          </a>
          <div className="font-mono flex flex-col gap-1.5 text-[11px] text-muted">
            <Link to="/privacy" className="hover:text-main transition-colors">
              {content.privacyLabel}
            </Link>
            <Link to="/cookies" className="hover:text-main transition-colors">
              {content.cookiesLabel}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
