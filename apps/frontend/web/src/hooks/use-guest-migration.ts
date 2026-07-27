import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { readActiveGuestInstance } from '@/lib/guest-storage';
import { migrateGuestDataToAccount } from '@/lib/guest-migration';
import { localizedProgramName } from '@/lib/catalog-display';

/**
 * Post-login hook: once a session becomes authenticated, migrate any leftover
 * guest program from localStorage into the account (see lib/guest-migration.ts)
 * and surface a success toast. Runs at most once per authenticated session and
 * never blocks or throws into the render path.
 */
export function useGuestMigration(): void {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const handledRef = useRef(false);

  useEffect(() => {
    if (user === null) {
      // The provider survives sign-out/sign-in navigation. A later account
      // conversion in the same SPA lifetime must get its own migration attempt.
      handledRef.current = false;
      return;
    }

    const attemptMigration = (): void => {
      if (handledRef.current || readActiveGuestInstance() === null) return;
      handledRef.current = true;
      void (async () => {
        try {
          const result = await migrateGuestDataToAccount(queryClient);
          if (result) {
            toast({
              message: t('guest_migration.success', {
                program: localizedProgramName(t, result.programId, result.programName),
              }),
            });
          } else if (readActiveGuestInstance() !== null) {
            // Transient failures and "account already active" skips intentionally
            // retain the guest data. Allow a later online transition to retry
            // without requiring a logout or full page reload.
            handledRef.current = false;
          }
        } catch (err: unknown) {
          handledRef.current = false;
          // Migration must never break the app; log and move on.
          console.warn(
            '[guest-migration] Unexpected migration error:',
            err instanceof Error ? err.message : 'Unknown error'
          );
        }
      })();
    };

    attemptMigration();
    window.addEventListener('online', attemptMigration);
    return () => window.removeEventListener('online', attemptMigration);
  }, [user, queryClient, toast, t]);
}
