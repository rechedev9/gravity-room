import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useScroll, useMotionValueEvent } from 'motion/react';
import { DISCORD_URL, NAV_LINKS, DiscordIcon } from './shared';

interface NavBarProps {
  readonly activeSection: string | null;
}

export function NavBar({ activeSection }: NavBarProps): React.ReactNode {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', (latest) => {
    setScrolled(latest > 80);
  });

  return (
    <nav
      aria-label="Navegación principal"
      className={`sticky top-0 z-50 flex items-center justify-between px-6 sm:px-10 py-4 transition-[background-color,border-color,backdrop-filter] duration-300 ${
        scrolled
          ? 'bg-header/95 backdrop-blur-md border-b border-rule'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
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
        {NAV_LINKS.map((link) => {
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
          aria-label="Únete a la comunidad en Discord"
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
          className="font-mono text-xs font-bold tracking-widest uppercase text-btn-text border border-btn-ring px-5 py-2.5 hover:bg-btn-active hover:text-btn-active-text hover:shadow-[0_0_20px_rgba(232,170,32,0.25)] transition-all duration-200"
        >
          Iniciar Sesión →
        </Link>
      </div>
    </nav>
  );
}
