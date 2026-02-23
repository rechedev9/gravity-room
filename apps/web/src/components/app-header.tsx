import { useAuth } from '@/contexts/auth-context';
import type { SyncStatus } from '@/types/sync-status';
import { AvatarDropdown } from './avatar-dropdown';

interface AppHeaderProps {
  readonly backLabel?: string;
  readonly onBack?: () => void;
  readonly onGoToProfile?: () => void;
  readonly syncStatus?: SyncStatus;
  readonly onSignOut?: () => void;
}

export function AppHeader({
  backLabel,
  onBack,
  onGoToProfile,
  syncStatus = 'idle',
  onSignOut,
}: AppHeaderProps): React.ReactNode {
  const { user, configured, signOut } = useAuth();

  const handleSignOut = onSignOut ?? ((): void => void signOut());

  return (
    <header className="flex items-center justify-between px-5 sm:px-8 py-4 bg-[var(--bg-header)] border-b border-[var(--border-color)]">
      <div className="flex items-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="font-mono text-xs font-medium tracking-widest uppercase transition-colors cursor-pointer mr-2 hover:text-[var(--text-header)] inline-flex items-center min-h-[44px] px-2"
            style={{ color: 'var(--text-muted)' }}
          >
            ← {backLabel ?? 'Volver'}
          </button>
        )}
        <img src="/logo.webp" alt="Logo" width={32} height={32} className="rounded-full" />
        <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-header)' }}>
          Gravity Room
        </span>
      </div>

      <AvatarDropdown
        user={user}
        configured={configured}
        syncStatus={syncStatus}
        onSignOut={handleSignOut}
        onGoToProfile={onGoToProfile}
      />
    </header>
  );
}
