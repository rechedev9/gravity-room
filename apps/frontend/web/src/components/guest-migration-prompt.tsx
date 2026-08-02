import { useTranslation } from 'react-i18next';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useGuestMigration } from '@/hooks/use-guest-migration';

/** Explicit account-bound decision for guest data left in this browser. */
export function GuestMigrationPrompt(): React.ReactNode {
  const { t } = useTranslation();
  const { pending, userEmail, isMigrating, confirmMigration, dismissMigration } =
    useGuestMigration();

  return (
    <ConfirmDialog
      open={pending}
      title={t('guest_migration.title')}
      message={
        <div className="space-y-2">
          <p>{t('guest_migration.message')}</p>
          {userEmail !== null && (
            <p className="font-medium text-main">
              {t('guest_migration.account', { email: userEmail })}
            </p>
          )}
          <p>{t('guest_migration.warning')}</p>
        </div>
      }
      confirmLabel={t('guest_migration.confirm')}
      cancelLabel={t('guest_migration.keep_local')}
      loading={isMigrating}
      onConfirm={() => void confirmMigration()}
      onCancel={dismissMigration}
    />
  );
}
