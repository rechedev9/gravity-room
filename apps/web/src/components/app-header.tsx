import { useAuth } from '@/contexts/auth-context';
import { AvatarDropdown } from './avatar-dropdown';

type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

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
    <header className="flex items-center justify-between px-5 sm:px-8 py-3.5 bg-[var(--bg-header)] border-b border-[var(--border-color)]">
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="font-mono text-[11px] font-medium tracking-widest uppercase transition-colors cursor-pointer mr-2 hover:text-[var(--text-header)]"
            style={{ color: 'var(--text-muted)' }}
          >
            ← {backLabel ?? 'Back'}
          </button>
        )}
        <img src="/logo.webp" alt="Logo" width={28} height={28} className="rounded-full" />
        <span className="text-sm font-bold tracking-tight" style={{ color: 'var(--text-header)' }}>
          The Real Hyperbolic Time Chamber
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
