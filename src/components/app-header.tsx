'use client';

import Image from 'next/image';
import type { SyncStatus } from '@/lib/sync';
import { useAuth } from '@/contexts/auth-context';
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
      <div className="flex items-center gap-3">
        {onBack && (
          <button
            onClick={onBack}
            className="text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-header)] transition-colors cursor-pointer mr-1"
          >
            &larr; {backLabel ?? 'Back'}
          </button>
        )}
        <Image
          src="/logo.webp"
          alt="Logo"
          width={32}
          height={32}
          className="rounded-full"
          priority
        />
        <span className="text-sm font-bold tracking-tight text-[var(--text-header)]">
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
