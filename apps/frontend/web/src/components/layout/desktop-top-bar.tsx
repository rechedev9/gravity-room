import { useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { OnlineIndicator } from '@/components/online-indicator';

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
 * left and the community indicator on the right. The ⌘K search field joins it
 * with the command palette. The title is a label, not a heading: each page
 * still owns its h1.
 */
export function DesktopTopBar(): React.ReactNode {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const titleKey = desktopPageTitleKey(pathname);

  return (
    <header
      data-testid="desktop-top-bar"
      className="hidden lg:flex sticky top-0 z-30 h-14 shrink-0 items-center justify-between gap-4 border-b border-rule bg-header px-6"
    >
      <span className="text-xl font-semibold text-main">{titleKey ? t(titleKey) : null}</span>
      <OnlineIndicator inline />
    </header>
  );
}
