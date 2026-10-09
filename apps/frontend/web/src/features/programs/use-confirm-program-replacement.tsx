import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { fetchPrograms } from '@/lib/api-functions';
import { localizedProgramName } from '@/lib/catalog-display';
import { captureError } from '@/lib/sentry';
import { queryKeys } from '@/lib/query-keys';

interface PendingReplacement {
  readonly currentName: string;
  readonly nextName: string;
  readonly resolve: (confirmed: boolean) => void;
}

export interface ConfirmProgramReplacement {
  /**
   * Resolves true when starting `nextName` may go ahead: either nothing is
   * active, or the user confirmed ending the active program. The server
   * completes the active program whenever a new one is created.
   */
  readonly confirmReplacement: (nextName: string) => Promise<boolean>;
  readonly dialog: ReactNode;
}

/**
 * Starting a program ends the active one. Both start flows (the guided
 * /app/start and the legacy setup form) ask first, so history is never closed
 * by a tap that looked like "preview this program".
 */
export function useConfirmProgramReplacement(): ConfirmProgramReplacement {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isGuest } = useGuest();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingReplacement | null>(null);
  const pendingRef = useRef<PendingReplacement | null>(null);

  const settle = useCallback((confirmed: boolean): void => {
    pendingRef.current?.resolve(confirmed);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const confirmReplacement = useCallback(
    async (nextName: string): Promise<boolean> => {
      if (user === null || isGuest) return true;
      let programs;
      try {
        programs = await queryClient.fetchQuery({
          queryKey: queryKeys.programs.all,
          queryFn: fetchPrograms,
          staleTime: 30_000,
        });
      } catch (error) {
        // Without the list we cannot tell; the create call reports its own failure.
        captureError(error);
        return true;
      }
      const active = programs.find((p) => p.status === 'active');
      if (active === undefined) return true;
      return new Promise<boolean>((resolve) => {
        const next: PendingReplacement = {
          currentName: localizedProgramName(t, active.programId, active.name),
          nextName,
          resolve,
        };
        pendingRef.current = next;
        setPending(next);
      });
    },
    [user, isGuest, queryClient, t]
  );

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title={t('programs.replace.title', { next: pending?.nextName ?? '' })}
      message={t('programs.replace.message', { current: pending?.currentName ?? '' })}
      confirmLabel={t('programs.replace.confirm')}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirmReplacement, dialog };
}
