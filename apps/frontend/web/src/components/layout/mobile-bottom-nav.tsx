import { useEffect } from 'react';
import { Link, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import {
  ExercisesTabIcon,
  ExploreTabIcon,
  MoreTabIcon,
  PlansTabIcon,
  TrainTabIcon,
} from './tab-icons';

export interface MobileTab {
  readonly id: 'train' | 'plans' | 'explore' | 'exercises' | 'more';
  readonly to: string;
  readonly labelKey: string;
  readonly isActive: (pathname: string) => boolean;
  readonly Icon: React.ComponentType<{ readonly className?: string }>;
}

function within(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * Same five tabs, order and labels as the mobile app. Home lives under Train (it is the
 * overview that leads into the tracker) and Insights under More, so every /app route
 * keeps one active tab.
 */
export const MOBILE_TABS: readonly MobileTab[] = [
  {
    id: 'train',
    to: '/app/tracker',
    labelKey: 'navigation.tab_train',
    isActive: (p) => p === '/app' || within(p, '/app/tracker') || within(p, '/app/start'),
    Icon: TrainTabIcon,
  },
  {
    id: 'plans',
    to: '/app/programs',
    labelKey: 'navigation.tab_plans',
    isActive: (p) => within(p, '/app/programs'),
    Icon: PlansTabIcon,
  },
  {
    id: 'explore',
    to: '/app/explore',
    labelKey: 'navigation.tab_explore',
    isActive: (p) => within(p, '/app/explore'),
    Icon: ExploreTabIcon,
  },
  {
    id: 'exercises',
    to: '/app/exercises',
    labelKey: 'navigation.tab_exercises',
    isActive: (p) => within(p, '/app/exercises'),
    Icon: ExercisesTabIcon,
  },
  {
    id: 'more',
    to: '/app/profile',
    labelKey: 'navigation.tab_more',
    isActive: (p) => within(p, '/app/profile') || within(p, '/app/insights'),
    Icon: MoreTabIcon,
  },
];

export function MobileBottomNav(): React.ReactNode {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Lets floating chrome (toasts, rest timer, cookie notice) clear the bar via --bottom-chrome.
  useEffect(() => {
    document.documentElement.setAttribute('data-tab-bar', '');
    return (): void => {
      document.documentElement.removeAttribute('data-tab-bar');
    };
  }, []);

  return (
    <nav
      aria-label={t('navigation.mobile_nav_label')}
      className="lg:hidden fixed bottom-0 inset-x-0 z-[55] border-t border-rule bg-header pt-1.5 pb-[max(env(safe-area-inset-bottom),0.375rem)]"
      style={{ minHeight: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom))' }}
      data-testid="mobile-bottom-nav"
    >
      <ul className="grid grid-cols-5 max-w-lg mx-auto">
        {MOBILE_TABS.map((tab) => {
          const isActive = tab.isActive(pathname);
          return (
            <li key={tab.id}>
              <Link
                to={tab.to}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-12 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-semibold leading-tight',
                  'transition-[color,transform] duration-[var(--duration-press)] ease-[var(--ease-press)] active:scale-[0.97]',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset rounded-control',
                  isActive ? 'text-accent' : 'text-muted hover:text-main'
                )}
              >
                <tab.Icon />
                <span>{t(tab.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
