import { useEffect, useState } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Kbd } from '@/components/ui/kbd';
import { OnlineIndicator } from '@/components/online-indicator';
import { useIsDesktop } from '@/hooks/use-is-desktop';
import { CommandPalette } from './command-palette';

function under(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

const TITLE_ROUTES: readonly (readonly [string, string])[] = [
  ['/app/start', 'desktop_shell.titles.start'],
  ['/app/tracker', 'desktop_shell.titles.train'],
  ['/app/programs', 'desktop_shell.titles.programs'],
  ['/app/explore', 'desktop_shell.titles.programs'],
  ['/app/insights', 'desktop_shell.titles.progress'],
  ['/app/exercises', 'desktop_shell.titles.exercises'],
  ['/app/profile', 'desktop_shell.titles.profile'],
];

/** i18n key of the desktop top-bar title for an /app pathname, or null when unknown. */
export function desktopPageTitleKey(pathname: string): string | null {
  if (pathname === '/app' || pathname === '/app/') return 'desktop_shell.titles.today';
  return TITLE_ROUTES.find(([base]) => under(pathname, base))?.[1] ?? null;
}

/**
 * Slim desktop bar (lg and up) above every /app page: the section title on the
 * left, the ⌘K search field and the community indicator on the right. The title
 * is a label, not a heading: each page still owns its h1.
 */
export function DesktopTopBar(): React.ReactNode {
  const { t } = useTranslation();
  const isDesktop = useIsDesktop();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const titleKey = desktopPageTitleKey(pathname);

  // ⌘K / Ctrl+K toggles the palette on lg+. Below lg this component renders
  // nothing, so the shortcut is not registered there either.
  useEffect(() => {
    if (!isDesktop) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      setPaletteOpen((open) => !open);
    };
    document.addEventListener('keydown', onKeyDown);
    return (): void => document.removeEventListener('keydown', onKeyDown);
  }, [isDesktop]);

  if (!isDesktop) return null;

  return (
    <>
      <header
        data-testid="desktop-top-bar"
        className="hidden lg:flex sticky top-0 z-30 h-14 shrink-0 items-center justify-between gap-4 border-b border-rule bg-header px-6"
      >
        <span className="text-xl font-semibold text-main">{titleKey ? t(titleKey) : null}</span>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label={t('desktop_shell.palette.open_label')}
            aria-keyshortcuts="Meta+K Control+K"
            aria-haspopup="dialog"
            className="flex h-9 w-[240px] items-center gap-2 rounded-control border border-rule bg-card px-3 text-left text-sm text-label transition-colors hover:border-rule-light hover:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent cursor-pointer"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-4 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4-4" />
            </svg>
            <span className="flex-1 truncate">{t('desktop_shell.palette.placeholder')}</span>
            <Kbd>⌘K</Kbd>
          </button>
          <OnlineIndicator inline />
        </div>
      </header>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </>
  );
}
