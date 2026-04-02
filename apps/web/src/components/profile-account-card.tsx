import { useState } from 'react';
import type { UserInfo } from '@/contexts/auth-context';
import { DashboardCard } from './dashboard-card';

interface ProfileAccountCardProps {
  readonly user: UserInfo;
  readonly displayName: string;
  readonly userInitials: string;
  readonly avatarUploading: boolean;
  readonly fileInputRef: React.RefObject<HTMLInputElement | null>;
  readonly onAvatarClick: () => void;
  readonly onFileChange: React.ChangeEventHandler<HTMLInputElement>;
  readonly onRemoveAvatar: () => void;
  readonly onDeleteRequest: () => void;
}

export function ProfileAccountCard({
  user,
  displayName,
  userInitials,
  avatarUploading,
  fileInputRef,
  onAvatarClick,
  onFileChange,
  onRemoveAvatar,
  onDeleteRequest,
}: ProfileAccountCardProps): React.ReactNode {
  const [showDangerZone, setShowDangerZone] = useState(false);

  return (
    <DashboardCard title="Cuenta">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onAvatarClick}
          disabled={avatarUploading}
          className="group relative w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-btn-active text-btn-active-text text-lg sm:text-xl font-extrabold cursor-pointer transition-opacity flex items-center justify-center overflow-hidden shrink-0 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50"
          aria-label="Cambiar avatar"
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            userInitials
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-colors pointer-events-none">
            <span className="text-white text-2xs font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">
              Cambiar
            </span>
          </div>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onFileChange}
        />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-title truncate">{displayName}</p>
          <p className="text-xs text-muted truncate">{user.email}</p>
          {user.avatarUrl && (
            <button
              type="button"
              onClick={onRemoveAvatar}
              disabled={avatarUploading}
              className="text-2xs text-muted underline mt-1 cursor-pointer hover:text-main transition-colors disabled:opacity-50"
            >
              Quitar foto
            </button>
          )}
        </div>
      </div>

      {/* Zona peligrosa — collapsible to reduce prominence of destructive action */}
      <div className="mt-3 pt-3 border-t border-rule">
        <button
          type="button"
          onClick={() => setShowDangerZone((v) => !v)}
          className="text-2xs text-muted hover:text-main transition-colors"
          aria-expanded={showDangerZone}
        >
          Zona peligrosa {showDangerZone ? '▲' : '▼'}
        </button>
        {showDangerZone && (
          <div className="mt-2">
            <button
              type="button"
              onClick={onDeleteRequest}
              className="text-2xs text-muted underline cursor-pointer hover:text-fail transition-colors"
            >
              Eliminar cuenta
            </button>
          </div>
        )}
      </div>
    </DashboardCard>
  );
}
