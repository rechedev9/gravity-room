import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import type { UserInfo } from '@/contexts/auth-context';
import type { SyncStatus } from '@/types/sync-status';
import { SYNC_LABELS, SYNC_COLORS } from '@/types/sync-status';
import { DropdownMenu, DropdownItem, DropdownDivider } from './dropdown-menu';

interface AvatarDropdownProps {
  readonly user: UserInfo | null;
  readonly configured: boolean;
  readonly syncStatus: SyncStatus;
  readonly onSignOut: () => void;
  readonly onGoToProfile?: () => void;
}

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
        to="/login"
        className="px-2 py-2 sm:px-3.5 sm:py-2.5 min-h-[44px] border-2 border-[var(--btn-border)] text-[10px] sm:text-xs font-bold cursor-pointer bg-[var(--btn-bg)] text-[var(--btn-text)] whitespace-nowrap transition-all hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)] inline-flex items-center no-underline"
      >
        Iniciar Sesión
      </Link>
    );
  }

  const initial = (user.email[0] ?? 'U').toUpperCase();
  const syncLabel = SYNC_LABELS[syncStatus];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-11 h-11 rounded-full bg-[var(--btn-hover-bg)] text-[var(--btn-hover-text)] text-sm font-extrabold cursor-pointer transition-opacity hover:opacity-80 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-[var(--fill-progress)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-body)] focus-visible:outline-none"
        aria-label="Menú de usuario"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {initial}
      </button>

      <DropdownMenu open={open} onClose={close} align="right">
        {/* Email */}
        <div className="px-4 py-2.5 text-xs text-[var(--text-muted)] truncate max-w-[220px]">
          {user.email}
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
            Perfil
          </DropdownItem>
        )}

        <DropdownItem
          onClick={() => {
            close();
            onSignOut();
          }}
        >
          Cerrar Sesión
        </DropdownItem>
      </DropdownMenu>
    </div>
  );
}
