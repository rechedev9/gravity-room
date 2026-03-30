import { Link } from 'react-router-dom';

/* ── Constants ────────────────────────────────────── */

export const DISCORD_URL = 'https://discord.gg/FXNBrgYf7U';

export const SECTION_IDS = ['features', 'how-it-works', 'programs'] as const;

export const NAV_LINKS = [
  { label: 'Características', href: '#features' },
  { label: 'Cómo Funciona', href: '#how-it-works' },
  { label: 'Programas', href: '#programs' },
] as const;

export const MAX_LANDING_PROGRAMS = 6;
export const CATALOG_STALE_TIME = 5 * 60 * 1000;
export const SECTION_PAD = 'px-6 sm:px-10 py-14 sm:py-20';

/* ── Gradient Divider ─────────────────────────────── */

export function GradientDivider(): React.ReactNode {
  return <div className="landing-gradient-divider" />;
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

/* ── Program helpers ──────────────────────────────── */

export function categoryLabel(category: string): string {
  switch (category) {
    case 'strength':
      return 'Fuerza';
    case 'hypertrophy':
      return 'Hipertrofia';
    case 'powerlifting':
      return 'Powerlifting';
    default:
      return category.charAt(0).toUpperCase() + category.slice(1);
  }
}

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

export function SkipToContent(): React.ReactNode {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-btn-active focus:text-btn-active-text focus:text-sm focus:font-bold"
    >
      Ir al contenido
    </a>
  );
}

/* ── Footer ───────────────────────────────────────── */

export function Footer(): React.ReactNode {
  return (
    <footer className="px-6 sm:px-10 py-10 bg-header border-t border-rule">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold mb-1 text-title">Gravity Room</p>
          <p className="text-xs text-muted">Para atletas que se niegan a estancarse.</p>
        </div>
        <div className="font-mono flex items-center gap-5 text-[11px] text-muted">
          <Link to="/privacy" className="hover:text-main transition-colors">
            Privacidad
          </Link>
          <span aria-hidden="true">&middot;</span>
          <Link to="/cookies" className="hover:text-main transition-colors">
            Cookies
          </Link>
          <span aria-hidden="true">&middot;</span>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-[#5865F2] transition-colors"
          >
            <DiscordIcon className="w-3 h-3" />
            Discord
          </a>
          <span aria-hidden="true">&middot;</span>
          <span>Built by Gravity Room</span>
        </div>
      </div>
    </footer>
  );
}
