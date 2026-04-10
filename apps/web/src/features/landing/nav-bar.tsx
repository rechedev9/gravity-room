import { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { useScroll, useMotionValueEvent } from 'motion/react';
import type { NavContent } from './content';
import { DISCORD_URL, DiscordIcon } from './shared';

interface NavBarProps {
  readonly activeSection: string | null;
  readonly content: NavContent;
}

export function NavBar({ activeSection, content }: NavBarProps): React.ReactNode {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (latest: number) => {
    setScrolled(latest > 80);
  });

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <nav
      aria-label={content.navLabel}
      className={`sticky top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-300 ${
        scrolled || menuOpen
          ? 'bg-header/95 backdrop-blur-md border-b border-rule'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="flex items-center justify-between px-6 sm:px-10 py-4">
        <div className="flex items-center gap-3">
          <img
            src="/logo.webp"
            alt="Gravity Room logo"
            width={32}
            height={32}
            className="rounded-full"
          />
          <span className="text-sm font-bold tracking-tight text-title">Gravity Room</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {content.links.map((link) => {
            const active = activeSection === link.href.slice(1);
            return (
              <a
                key={link.href}
                href={link.href}
                data-active={active || undefined}
                className={`nav-link-underline font-mono text-xs font-semibold tracking-widest uppercase transition-colors duration-200 ${
                  active ? 'text-title' : 'text-muted hover:text-title'
                }`}
                style={{ fontSize: '11px' }}
              >
                {link.label}
              </a>
            );
          })}
        </div>

        <div className="flex items-center gap-3">
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={content.discordAriaLabel}
            className="flex items-center gap-2 text-muted hover:text-[#5865F2] transition-colors duration-200"
          >
            <DiscordIcon className="w-4 h-4" />
            <span
              className="hidden md:inline font-mono font-semibold tracking-widest uppercase"
              style={{ fontSize: '11px' }}
            >
              Discord
            </span>
          </a>
          <Link
            to="/login"
            className="hidden md:inline-block font-mono text-xs font-bold tracking-widest uppercase text-btn-text border border-btn-ring px-5 py-2.5 hover:bg-btn-active hover:text-btn-active-text hover:shadow-[0_0_20px_rgba(232,170,32,0.25)] transition-all duration-200"
          >
            {content.signInLabel}
          </Link>

          <button
            type="button"
            className="md:hidden p-1.5 text-muted hover:text-main transition-colors"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? content.closeMenuLabel : content.openMenuLabel}
            aria-expanded={menuOpen}
            aria-haspopup="true"
            aria-controls="mobile-nav"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              {menuOpen ? <path d="M2 2l14 14M16 2L2 16" /> : <path d="M2 4h14M2 9h14M2 14h14" />}
            </svg>
          </button>
        </div>
      </div>

      {menuOpen && (
        <div id="mobile-nav" className="md:hidden border-t border-rule px-6 py-2 flex flex-col">
          {content.links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="py-3 font-mono text-xs font-semibold tracking-widest uppercase text-muted hover:text-main transition-colors border-b border-rule last:border-0"
            >
              {link.label}
            </a>
          ))}
          <div className="py-3">
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="font-mono text-xs font-bold tracking-widest uppercase text-btn-text border border-btn-ring px-5 py-2.5 hover:bg-btn-active hover:text-btn-active-text transition-all duration-200 inline-block"
            >
              {content.signInLabel}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
