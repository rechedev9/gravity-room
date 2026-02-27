import { Link } from 'react-router-dom';
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
  const { user, signOut } = useAuth();

  const handleSignOut = onSignOut ?? ((): void => void signOut());

  return (
    <header
      className="flex items-center justify-between px-5 sm:px-8 py-4 bg-header border-b border-rule shadow-[0_1px_8px_rgba(0,0,0,0.4)]"
      style={{
        borderImage:
          'linear-gradient(90deg, var(--color-rule) 0%, rgba(232, 170, 32, 0.2) 50%, var(--color-rule) 100%) 1',
      }}
    >
      <div className="flex items-center gap-4">
        {onBack && (
          <button
            onClick={onBack}
            className="font-mono text-xs font-medium tracking-widest uppercase transition-colors cursor-pointer mr-2 hover:text-heading inline-flex items-center min-h-[44px] px-2 text-muted"
          >
            ← {backLabel ?? 'Volver'}
          </button>
        )}
        <Link to="/app" className="flex items-center gap-4">
          <img src="/logo.webp" alt="Logo" width={32} height={32} className="rounded-sm" />
          <span className="text-sm font-bold tracking-tight text-heading">Gravity Room</span>
        </Link>
      </div>

      <AvatarDropdown
        user={user}
        syncStatus={syncStatus}
        onSignOut={handleSignOut}
        onGoToProfile={onGoToProfile}
      />
    </header>
  );
}
