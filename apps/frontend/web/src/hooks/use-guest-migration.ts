import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { getAuthSessionIdentity, useAuth } from '@/contexts/auth-context';
import { useToast } from '@/contexts/toast-context';
import { readActiveGuestInstance } from '@/lib/guest-storage';
import {
  discardGuestMigrationData,
  hasFreshGuestMigrationIntent,
  migrateGuestDataToAccount,
  type GuestMigrationIdentity,
} from '@/lib/guest-migration';
import { localizedProgramName } from '@/lib/catalog-display';

interface PendingGuestMigration {
  readonly identity: GuestMigrationIdentity;
  readonly userEmail: string;
}

export interface GuestMigrationPromptState {
  readonly pending: boolean;
  readonly userEmail: string | null;
  readonly isMigrating: boolean;
  readonly confirmMigration: () => Promise<void>;
  readonly dismissMigration: () => void;
}

/**
 * Offers leftover guest data to the signed-in user, but never imports it
 * automatically. Confirmation is deliberately account-specific and in-memory:
 * another account receives a fresh prompt rather than inheriting consent.
 */
export function useGuestMigration(): GuestMigrationPromptState {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [pending, setPending] = useState<PendingGuestMigration | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);

  const readCurrentIdentity = useCallback(
    (): GuestMigrationIdentity | null => getAuthSessionIdentity(),
    []
  );

  useEffect(() => {
    setIsMigrating(false);
    if (user === null) {
      setPending(null);
      return;
    }

    if (readActiveGuestInstance() === null) {
      setPending(null);
      return;
    }

    if (!hasFreshGuestMigrationIntent()) {
      discardGuestMigrationData();
      setPending(null);
      return;
    }

    const identity = readCurrentIdentity();
    if (identity === null || identity.userId !== user.id) {
      setPending(null);
      return;
    }

    setPending({ identity, userEmail: user.email });
  }, [user, readCurrentIdentity]);

  const dismissMigration = useCallback((): void => {
    if (isMigrating) return;
    // A dismissal is intentionally non-destructive. The local copy is never
    // uploaded without confirmation and expires with the migration intent.
    setPending(null);
  }, [isMigrating]);

  const confirmMigration = useCallback(async (): Promise<void> => {
    if (pending === null || isMigrating) return;
    const currentIdentity = readCurrentIdentity();
    if (
      currentIdentity?.userId !== pending.identity.userId ||
      currentIdentity.sessionId !== pending.identity.sessionId
    ) {
      setPending(null);
      return;
    }

    setIsMigrating(true);
    try {
      const result = await migrateGuestDataToAccount(
        queryClient,
        pending.identity,
        readCurrentIdentity
      );
      if (result) {
        setPending(null);
        toast({
          message: t('guest_migration.success', {
            program: localizedProgramName(t, result.programId, result.programName),
          }),
        });
      } else {
        if (readActiveGuestInstance() === null) setPending(null);
        toast({ message: t('guest_migration.not_imported') });
      }
    } catch {
      toast({ message: t('guest_migration.not_imported') });
    } finally {
      setIsMigrating(false);
    }
  }, [pending, isMigrating, queryClient, readCurrentIdentity, toast, t]);

  return {
    pending: pending !== null,
    userEmail: pending?.userEmail ?? null,
    isMigrating,
    confirmMigration,
    dismissMigration,
  };
}
