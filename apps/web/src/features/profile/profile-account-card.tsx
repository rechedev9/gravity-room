import { useState, useRef } from 'react';
import type { UserInfo } from '@/contexts/auth-context';
import type { WeightUnit } from '@/hooks/use-unit-preference';
import { DashboardCard } from '@/components/dashboard-card';

interface ProfileAccountCardProps {
  readonly user: UserInfo;
  readonly displayName: string;
  readonly userInitials: string;
  readonly avatarUploading: boolean;
  readonly fileInputRef: React.RefObject<HTMLInputElement | null>;
  readonly unit: WeightUnit;
  readonly onAvatarClick: () => void;
  readonly onFileChange: React.ChangeEventHandler<HTMLInputElement>;
  readonly onRemoveAvatar: () => void;
  readonly onDeleteRequest: () => void;
  readonly onUpdateName: (name: string) => Promise<void>;
  readonly onToggleUnit: () => void;
}

export function ProfileAccountCard({
  user,
  displayName,
  userInitials,
  avatarUploading,
  fileInputRef,
  unit,
  onAvatarClick,
  onFileChange,
  onRemoveAvatar,
  onDeleteRequest,
  onUpdateName,
  onToggleUnit,
}: ProfileAccountCardProps): React.ReactNode {
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState('');
  // React fires onBlur when the input unmounts (after setEditing(false)), so without
  // this guard a cancelled edit would still call onUpdateName via the blur handler.
  const cancelRef = useRef(false);

  const handleEditStart = (): void => {
    cancelRef.current = false;
    setNameValue(displayName);
    setEditing(true);
  };

  const handleSave = async (): Promise<void> => {
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    const trimmed = nameValue.trim();
    setEditing(false);
    if (trimmed && trimmed !== displayName) {
      await onUpdateName(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.currentTarget.blur(); // onBlur handles the save; explicit blur prevents double-fire
    }
    if (e.key === 'Escape') {
      cancelRef.current = true;
      setEditing(false);
    }
  };

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
          {editing ? (
            <input
              type="text"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={() => void handleSave()}
              onKeyDown={handleKeyDown}
              className="text-sm font-bold text-title bg-transparent border-b border-accent focus:outline-none w-full"
              autoFocus
              aria-label="Nombre de usuario"
            />
          ) : (
            <button
              type="button"
              onClick={handleEditStart}
              className="group flex items-center gap-1 text-sm font-bold text-title hover:text-main transition-colors cursor-pointer text-left truncate w-full"
              title="Editar nombre"
            >
              <span className="truncate">{displayName}</span>
              <span className="text-muted opacity-0 group-hover:opacity-60 transition-opacity shrink-0">
                ✎
              </span>
            </button>
          )}
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

      {/* Unit preference toggle */}
      <div className="mt-3 pt-3 border-t border-rule flex items-center justify-between">
        <span className="text-2xs text-muted">Unidad de peso</span>
        <button
          type="button"
          onClick={onToggleUnit}
          className="flex items-center gap-0.5 font-mono text-2xs border border-rule px-2 py-0.5 hover:border-accent hover:text-title transition-colors"
          aria-label={`Cambiar a ${unit === 'kg' ? 'libras' : 'kilogramos'}`}
        >
          <span className={unit === 'kg' ? 'text-title font-bold' : 'text-muted'}>kg</span>
          <span className="text-muted mx-0.5">/</span>
          <span className={unit === 'lbs' ? 'text-title font-bold' : 'text-muted'}>lbs</span>
        </button>
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
