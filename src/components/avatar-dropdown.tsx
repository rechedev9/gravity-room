'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import type { SyncStatus } from '@/lib/sync';
import { DropdownMenu, DropdownItem, DropdownDivider } from './dropdown-menu';

interface AvatarDropdownProps {
  readonly user: User | null;
  readonly configured: boolean;
  readonly syncStatus: SyncStatus;
  readonly onSignOut: () => void;
  readonly onGoToProfile?: () => void;
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

export function AvatarDropdown({
  user,
  configured,
  syncStatus,
  onSignOut,
  onGoToProfile,
}: AvatarDropdownProps): React.ReactNode {
  const [open, setOpen] = useState(false);
  const close = useCallback((): void => setOpen(false), []);

  if (!configured) return null;

  if (!user) {
    return (
      <Link
        href="/login"
        className="px-2 py-2 sm:px-3.5 sm:py-2.5 min-h-[44px] border-2 border-[var(--btn-border)] text-[10px] sm:text-xs font-bold cursor-pointer bg-[var(--btn-bg)] text-[var(--btn-text)] whitespace-nowrap transition-all hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)] inline-flex items-center no-underline"
      >
        Sign In
      </Link>
    );
  }

  const initial = (user.email?.[0] ?? 'U').toUpperCase();
  const displayEmail = user.email ?? 'User';
  const syncLabel = SYNC_LABELS[syncStatus];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-9 h-9 rounded-full bg-[var(--btn-hover-bg)] text-[var(--btn-hover-text)] text-sm font-extrabold cursor-pointer transition-opacity hover:opacity-80 flex items-center justify-center"
        aria-label="User menu"
      >
        {initial}
      </button>

      <DropdownMenu open={open} onClose={close} align="right">
        {/* Email */}
        <div className="px-4 py-2.5 text-xs text-[var(--text-muted)] truncate max-w-[220px]">
          {displayEmail}
        </div>

        {/* Sync status */}
        {syncLabel && (
          <div className={`px-4 py-1 text-[11px] font-bold ${SYNC_COLORS[syncStatus]}`}>
            {syncLabel}
          </div>
        )}

        <DropdownDivider />

        {onGoToProfile && (
          <DropdownItem
            onClick={() => {
              close();
              onGoToProfile();
            }}
          >
            Profile
          </DropdownItem>
        )}

        <DropdownItem
          onClick={() => {
            close();
            onSignOut();
          }}
        >
          Sign Out
        </DropdownItem>
      </DropdownMenu>
    </div>
  );
}
