import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { fetchPrograms } from '@/lib/api-functions';
import { useTracker } from '@/contexts/tracker-context';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { localizedProgramName } from '@/lib/catalog-display';
import { readActiveGuestInstance } from '@/lib/guest-storage';
import { ProgramApp } from '@/features/tracker/program-app';
import { TrackerGuestEmpty } from '@/features/tracker/tracker-guest-empty';

export function TrackerPage(): React.ReactNode {
  const { t } = useTranslation();
  const rawParams = useParams({ strict: false });
  const programIdParam: string | undefined =
    typeof rawParams.programId === 'string' ? rawParams.programId : undefined;
  const { instanceId, programId: ctxProgramId, clearTracker } = useTracker();
  const { user } = useAuth();
  const { isGuest } = useGuest();
  const navigate = useNavigate();

  const programsQuery = useQuery({
    queryKey: queryKeys.programs.all,
    queryFn: fetchPrograms,
    enabled: user !== null && !isGuest,
    staleTime: 5 * 60 * 1000,
  });

  // Guests have no server programs query (it's disabled above); their sole
  // persistence is localStorage. A reload wipes the in-memory TrackerContext,
  // so without this fallback /app/tracker would redirect a guest with an
  // in-progress program back to /app. Read the persisted guest instance's
  // catalog programId as the last resort in the fallback chain.
  const guestProgramId = useMemo(
    (): string | undefined => (isGuest ? readActiveGuestInstance()?.programId : undefined),
    [isGuest]
  );

  // Fallback chain: URL param → context → guest storage → active program from API
  const activeProgram = programsQuery.data?.find((p) => p.status === 'active');
  const effectiveProgramId =
    programIdParam ?? ctxProgramId ?? guestProgramId ?? activeProgram?.programId;

  const storedName =
    programsQuery.data?.find((p) => p.id === instanceId)?.name ?? activeProgram?.name ?? null;
  const displayName =
    effectiveProgramId && storedName
      ? localizedProgramName(t, effectiveProgramId, storedName)
      : storedName;

  useDocumentTitle(
    displayName ? `${displayName} — ${t('tracker.page_title')}` : t('tracker.page_title')
  );

  // A guest with no in-progress program is NOT redirected to /app: bouncing
  // them there both showed the generic guest wall and left the sidebar
  // highlighting "Inicio" instead of "Tracker". Guests can track locally once
  // they pick a program, so we keep them on /app/tracker and point them at the
  // catalog. Authenticated users with no program still redirect home.
  const shouldRedirect = !effectiveProgramId && !programsQuery.isLoading && !isGuest;
  useEffect(() => {
    if (shouldRedirect) {
      void navigate({ to: '/app', replace: true });
    }
  }, [shouldRedirect, navigate]);

  if (!effectiveProgramId) {
    return isGuest ? <TrackerGuestEmpty /> : null;
  }

  const handleBack = (): void => {
    clearTracker();
    void navigate({ to: '/app' });
  };

  const handleReset = (): void => {
    // Keep programId, clear instanceId — re-navigate to same URL without instance
    void navigate({
      to: '/app/tracker/$programId',
      params: { programId: effectiveProgramId },
      replace: true,
    });
  };

  const handleGoToProfile = (): void => {
    void navigate({ to: '/app/profile' });
  };

  return (
    <ProgramApp
      programId={effectiveProgramId}
      instanceId={instanceId}
      isActive
      onBackToDashboard={handleBack}
      onProgramReset={handleReset}
      onGoToProfile={handleGoToProfile}
    />
  );
}
