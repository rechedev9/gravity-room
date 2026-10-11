import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import type { UserInfo } from '@gzclp/domain/schemas/user';
import type { WeightUnit } from '@gzclp/domain/weight-unit';
import { LanguageSelector } from '@/components/language-selector';
import { ThemeSelector } from '@/components/theme-selector';

const NameSchema = z.object({
  name: z.string().trim().min(1, 'Name required').max(64),
});

type NameFormValues = z.infer<typeof NameSchema>;

interface ProfileIdentityCardProps {
  readonly user: UserInfo;
  readonly displayName: string;
  readonly userInitials: string;
  readonly avatarUploading: boolean;
  readonly fileInputRef: React.RefObject<HTMLInputElement | null>;
  readonly onAvatarClick: () => void;
  readonly onFileChange: React.ChangeEventHandler<HTMLInputElement>;
  readonly onRemoveAvatar: () => void;
  readonly onUpdateName: (name: string) => Promise<void>;
}

/** Mobile IdentityCard: avatar tile, name and email. Avatar and name stay editable on web. */
export function ProfileIdentityCard({
  user,
  displayName,
  userInitials,
  avatarUploading,
  fileInputRef,
  onAvatarClick,
  onFileChange,
  onRemoveAvatar,
  onUpdateName,
}: ProfileIdentityCardProps): React.ReactNode {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  // React fires onBlur when the input unmounts (after setEditing(false)), so without
  // this guard a cancelled edit would still call onUpdateName via the blur handler.
  const cancelRef = useRef(false);

  const { register, handleSubmit, reset } = useForm<NameFormValues>({
    resolver: zodResolver(NameSchema),
    defaultValues: { name: displayName },
  });

  const handleEditStart = (): void => {
    cancelRef.current = false;
    reset({ name: displayName });
    setEditing(true);
  };

  const doSave = async ({ name }: NameFormValues): Promise<void> => {
    if (cancelRef.current) {
      cancelRef.current = false;
      return;
    }
    setEditing(false);
    if (name.trim() && name.trim() !== displayName) {
      await onUpdateName(name.trim());
    }
  };

  const handleBlur = (): void => {
    // On validation failure (e.g. blank name), collapse editing mode rather than
    // leaving the user stuck with a visible error and no way out except Escape.
    void handleSubmit(doSave, () => setEditing(false))();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      e.currentTarget.blur(); // onBlur handles the save
    }
    if (e.key === 'Escape') {
      cancelRef.current = true;
      setEditing(false);
    }
  };

  return (
    <section
      aria-label={t('profile.account.title')}
      className="bg-card border border-rule rounded-card p-4"
    >
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          onClick={onAvatarClick}
          disabled={avatarUploading}
          className="group relative size-[52px] rounded-full bg-surface-2 border border-accent-dim text-accent text-lg font-bold tracking-wide cursor-pointer transition-opacity flex items-center justify-center overflow-hidden shrink-0 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50"
          aria-label={t('profile.account.change_avatar_label')}
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            userInitials
          )}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors pointer-events-none">
            <span className="text-main text-2xs font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity">
              {t('profile.account.change_avatar_text')}
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
              {...register('name')}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              className="type-title text-title bg-transparent border-b border-accent focus:outline-none w-full"
              autoFocus
              aria-label={t('profile.account.username_input_label')}
            />
          ) : (
            <button
              type="button"
              onClick={handleEditStart}
              className="group flex min-h-8 w-full cursor-pointer items-center gap-1.5 truncate text-left type-title text-title transition-colors hover:text-main"
              title={t('profile.account.edit_name_tooltip')}
            >
              <span className="truncate">{displayName}</span>
              <span className="shrink-0 text-sm text-muted opacity-60 transition-opacity group-hover:opacity-100">
                ✎
              </span>
            </button>
          )}
          {/* When the user has no display name, `displayName` falls back to the
              email and the editable control above already shows it - so only
              render the email here when it isn't a duplicate of that control. */}
          {displayName !== user.email && (
            <p className="truncate text-sm text-muted">{user.email}</p>
          )}
          {user.avatarUrl && (
            <button
              type="button"
              onClick={onRemoveAvatar}
              disabled={avatarUploading}
              className="mt-1 cursor-pointer text-2xs text-muted underline transition-colors hover:text-main disabled:opacity-50"
            >
              {t('profile.account.remove_photo')}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

// Segments share the row evenly on phones, like the mobile SegmentedChoice.
const FILL_ON_PHONE = 'w-full sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none';

function PreferenceRow({
  label,
  children,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
}): React.ReactNode {
  return (
    <div className="flex flex-col gap-2.5 border-b border-rule p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-main">{label}</span>
      {children}
    </div>
  );
}

interface ProfilePreferencesProps {
  readonly unit: WeightUnit;
  readonly onToggleUnit: () => void;
}

/** Weight unit, language and theme as one grouped card, like the mobile preferences group. */
export function ProfilePreferences({
  unit,
  onToggleUnit,
}: ProfilePreferencesProps): React.ReactNode {
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden rounded-card border border-rule bg-card">
      <PreferenceRow label={t('profile.account.weight_unit_label')}>
        <button
          type="button"
          onClick={onToggleUnit}
          className="flex min-h-11 w-fit items-center gap-0.5 rounded-control border border-rule bg-header px-4 py-2 font-mono text-xs transition-colors hover:border-accent"
          aria-label={t('profile.account.change_unit_aria', {
            unit: unit === 'kg' ? t('profile.account.unit_lbs') : t('profile.account.unit_kg'),
          })}
        >
          <span className={unit === 'kg' ? 'font-bold text-accent' : 'text-muted'}>kg</span>
          <span className="mx-1 text-muted">/</span>
          <span className={unit === 'lbs' ? 'font-bold text-accent' : 'text-muted'}>lbs</span>
        </button>
      </PreferenceRow>
      <PreferenceRow label={t('profile.account.language_label')}>
        <LanguageSelector className={FILL_ON_PHONE} />
      </PreferenceRow>
      <PreferenceRow label={t('profile.account.theme_label')}>
        <ThemeSelector className={FILL_ON_PHONE} />
      </PreferenceRow>
    </div>
  );
}

interface ProfileDangerZoneProps {
  readonly onDeleteRequest: () => void;
}

/** Collapsible so the destructive action stays out of the way. */
export function ProfileDangerZone({ onDeleteRequest }: ProfileDangerZoneProps): React.ReactNode {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="min-h-11 px-2 text-xs text-muted transition-colors hover:text-main"
        aria-expanded={open}
      >
        {t('profile.account.danger_zone')} {open ? '▲' : '▼'}
      </button>
      {open && (
        <div className="mt-1">
          <button
            type="button"
            onClick={onDeleteRequest}
            className="min-h-11 cursor-pointer px-2 text-xs text-muted underline transition-colors hover:text-fail"
          >
            {t('profile.account.delete_account')}
          </button>
        </div>
      )}
    </div>
  );
}
