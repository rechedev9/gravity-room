import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { UserInfo } from '@/contexts/auth-context';
import type { SyncStatus } from '@/types/sync-status';
import { SYNC_LABELS, SYNC_COLORS } from '@/types/sync-status';
import { DropdownMenu, DropdownItem, DropdownDivider } from './dropdown-menu';

interface AvatarDropdownProps {
  readonly user: UserInfo | null;
  readonly syncStatus: SyncStatus;
  readonly onSignOut: () => void;
  readonly onGoToProfile?: () => void;
}

export function AvatarDropdown({
  user,
  syncStatus,
  onSignOut,
  onGoToProfile,
}: AvatarDropdownProps): React.ReactNode {
  const [open, setOpen] = useState(false);
  const close = (): void => setOpen(false);

  if (!user) {
    return (
      <Link
        to="/login"
        className="px-2 py-2 sm:px-3.5 sm:py-2.5 min-h-[44px] border-2 border-btn-ring text-[10px] sm:text-xs font-bold cursor-pointer bg-btn text-btn-text whitespace-nowrap transition-all hover:bg-btn-active hover:text-btn-active-text inline-flex items-center no-underline"
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
        className="w-11 h-11 rounded-full bg-btn-active text-btn-active-text text-sm font-extrabold cursor-pointer transition-all duration-150 hover:opacity-80 hover:shadow-[0_0_12px_rgba(232,170,32,0.2)] active:scale-95 flex items-center justify-center focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-body focus-visible:outline-none overflow-hidden"
        aria-label="Menú de usuario"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          initial
        )}
      </button>

      <DropdownMenu open={open} onClose={close} align="right">
        {/* Email */}
        <div className="px-4 py-2.5 text-xs text-muted truncate max-w-[220px]">{user.email}</div>

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
