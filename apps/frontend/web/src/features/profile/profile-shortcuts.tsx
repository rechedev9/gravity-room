import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { InsightsIcon, HomeIcon } from '@/components/layout/sidebar-icons';

interface ShortcutRow {
  readonly to: string;
  readonly labelKey: string;
  readonly hintKey: string;
  readonly Icon: React.ComponentType<{ readonly className?: string }>;
  readonly guestHidden?: boolean;
}

const SHORTCUTS: readonly ShortcutRow[] = [
  { to: '/app', labelKey: 'navigation.home', hintKey: 'profile.more.home_hint', Icon: HomeIcon },
  {
    to: '/app/insights',
    labelKey: 'navigation.insights',
    hintKey: 'profile.more.insights_hint',
    Icon: InsightsIcon,
    guestHidden: true,
  },
];

/**
 * Destinations that have no tab on the phone bar (Home and Insights). The sidebar already
 * lists them on desktop, so this group is phone-only.
 */
export function ProfileShortcuts({ isGuest }: { readonly isGuest: boolean }): React.ReactNode {
  const { t } = useTranslation();
  const rows = SHORTCUTS.filter((row) => !(row.guestHidden && isGuest));

  return (
    <div className="bg-card border border-rule rounded-card overflow-hidden">
      {rows.map((row) => (
        <Link
          key={row.to}
          to={row.to}
          className="flex min-h-14 items-center gap-3 border-b border-rule px-4 py-3 last:border-b-0 hover:bg-surface-2 transition-colors"
        >
          <row.Icon className="size-5 shrink-0 text-muted" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-main">{t(row.labelKey)}</span>
            <span className="block text-xs text-muted">{t(row.hintKey)}</span>
          </span>
          <span aria-hidden="true" className="text-muted">
            &rsaquo;
          </span>
        </Link>
      ))}
    </div>
  );
}
