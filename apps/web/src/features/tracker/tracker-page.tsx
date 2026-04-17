import { useEffect } from 'react';
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
import { ProgramApp } from '@/features/tracker/program-app';

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

  // Fallback chain: URL param → context → active program from API
  const activeProgram = programsQuery.data?.find((p) => p.status === 'active');
  const effectiveProgramId = programIdParam ?? ctxProgramId ?? activeProgram?.programId;

  const storedName =
    programsQuery.data?.find((p) => p.id === instanceId)?.name ?? activeProgram?.name ?? null;
  const displayName =
    effectiveProgramId && storedName
      ? localizedProgramName(t, effectiveProgramId, storedName)
      : storedName;

  useDocumentTitle(
    displayName ? `${displayName} — ${t('tracker.page_title')}` : t('tracker.page_title')
  );

  // Redirect to home when no program is available (after query settles)
  const shouldRedirect = !effectiveProgramId && !programsQuery.isLoading;
  useEffect(() => {
    if (shouldRedirect) {
      void navigate({ to: '/app', replace: true });
    }
  }, [shouldRedirect, navigate]);

  if (!effectiveProgramId) return null;

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
