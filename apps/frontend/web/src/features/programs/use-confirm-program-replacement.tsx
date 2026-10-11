import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { useToast } from '@/contexts/toast-context';
import { fetchPrograms } from '@/lib/api-functions';
import { localizedProgramName } from '@/lib/catalog-display';
import { readActiveGuestInstance } from '@/lib/guest-storage';
import { captureError } from '@/lib/sentry';
import { queryKeys } from '@/lib/query-keys';

interface PendingReplacement {
  /** A guest start deletes the local results; an account start keeps the history. */
  readonly losesResults: boolean;
  readonly currentName: string;
  readonly nextName: string;
  readonly resolve: (confirmed: boolean) => void;
}

export interface ConfirmProgramReplacement {
  /**
   * Resolves true when starting `nextName` may go ahead: either nothing is
   * active, or the user confirmed ending the active program. The server
   * completes the active program whenever a new one is created, and a guest
   * start replaces the local program and its results.
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
  const { toast } = useToast();
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
      const ask = (current: Omit<PendingReplacement, 'nextName' | 'resolve'>): Promise<boolean> =>
        new Promise<boolean>((resolve) => {
          const next: PendingReplacement = { ...current, nextName, resolve };
          pendingRef.current = next;
          setPending(next);
        });

      if (user === null || isGuest) {
        const local = readActiveGuestInstance();
        const hasResults =
          local !== null && Object.values(local.results).some((day) => Object.keys(day).length > 0);
        if (local === null || !hasResults) return true;
        return ask({
          losesResults: true,
          currentName: localizedProgramName(t, local.programId, local.name),
        });
      }
      let programs;
      try {
        programs = await queryClient.fetchQuery({
          queryKey: queryKeys.programs.all,
          queryFn: fetchPrograms,
          staleTime: 30_000,
        });
      } catch (error) {
        // Without the list we cannot tell, and the server would end the active program unasked.
        captureError(error);
        toast({ message: t('programs.replace.load_error') });
        return false;
      }
      const active = programs.find((p) => p.status === 'active');
      if (active === undefined) return true;
      return ask({
        losesResults: false,
        currentName: localizedProgramName(t, active.programId, active.name),
      });
    },
    [user, isGuest, queryClient, t, toast]
  );

  const current = pending?.currentName ?? '';

  const dialog = (
    <ConfirmDialog
      open={pending !== null}
      title={t('programs.replace.title', { next: pending?.nextName ?? '' })}
      message={
        pending?.losesResults === true
          ? t('programs.replace.guest_message', { current })
          : t('programs.replace.message', { current })
      }
      confirmLabel={
        pending?.losesResults === true
          ? t('programs.replace.guest_confirm')
          : t('programs.replace.confirm')
      }
      variant={pending?.losesResults === true ? 'danger' : 'default'}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );

  return { confirmReplacement, dialog };
}
