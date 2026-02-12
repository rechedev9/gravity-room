'use client';

import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import type { SyncStatus } from '@/lib/sync';

interface UserMenuProps {
  readonly user: User | null;
  readonly syncStatus: SyncStatus;
  readonly onSignOut: () => void;
}

const SYNC_LABELS: Readonly<Record<SyncStatus, string>> = {
  idle: '',
  syncing: 'Syncing...',
  synced: 'Synced',
  offline: 'Offline',
  error: 'Sync error',
};

const SYNC_COLORS: Readonly<Record<SyncStatus, string>> = {
  idle: '',
  syncing: 'text-[var(--btn-text)]',
  synced: 'text-[var(--text-badge-ok)]',
  offline: 'text-[var(--text-muted)]',
  error: 'text-[var(--text-error)]',
};

export function UserMenu({ user, syncStatus, onSignOut }: UserMenuProps): React.ReactNode {
  const btnClass =
    'px-2 py-2 sm:px-3.5 sm:py-2.5 min-h-[44px] border-2 border-[var(--btn-border)] text-[10px] sm:text-xs font-bold cursor-pointer bg-[var(--btn-bg)] text-[var(--btn-text)] whitespace-nowrap transition-all hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)]';

  if (!user) {
    return (
      <Link href="/login" className={btnClass + ' inline-flex items-center no-underline'}>
        Sign In
      </Link>
    );
  }

  const displayEmail = user.email ?? 'User';
  const syncLabel = SYNC_LABELS[syncStatus];

  return (
    <div className="flex items-center gap-2">
      {syncLabel && (
        <span className={`text-[10px] sm:text-[11px] font-bold ${SYNC_COLORS[syncStatus]}`}>
          {syncLabel}
        </span>
      )}
      <span className="text-[10px] sm:text-[11px] text-[var(--text-muted)] truncate max-w-[100px] sm:max-w-[150px]">
        {displayEmail}
      </span>
      <button className={btnClass} onClick={onSignOut}>
        Sign Out
      </button>
    </div>
  );
}
