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
    if (user === null || handledRef.current) return;

    // Only act when there is actually a persisted guest program to migrate, so
    // an ordinary returning user pays nothing.
    if (readActiveGuestInstance() === null) return;

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
        }
      } catch (err: unknown) {
        // Migration must never break the app; log and move on.
        console.warn(
          '[guest-migration] Unexpected migration error:',
          err instanceof Error ? err.message : 'Unknown error'
        );
      }
    })();
  }, [user, queryClient, toast, t]);
}
