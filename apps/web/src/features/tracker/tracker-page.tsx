import { useParams, useNavigate, redirect } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { fetchPrograms } from '@/lib/api-functions';
import { useTracker } from '@/contexts/tracker-context';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { ProgramApp } from '@/features/tracker/program-app';

export function TrackerPage(): React.ReactNode {
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

  // Fallback to context programId when URL param is absent
  const effectiveProgramId = programIdParam ?? ctxProgramId;

  const programName =
    programsQuery.data?.find((p) => p.id === instanceId)?.name ??
    programsQuery.data?.find((p) => p.status === 'active')?.name ??
    null;

  useDocumentTitle(
    programName ? `${programName} — Tracker — Gravity Room` : 'Tracker — Gravity Room'
  );

  if (!effectiveProgramId) {
    throw redirect({ to: '/app', replace: true });
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
