import { useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { fetchPrograms } from '@/lib/api-functions';
import { useTracker } from '@/contexts/tracker-context';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { DEFAULT_PAGE_TITLE } from '@/lib/page-title';
import { ProgramApp } from '@/features/tracker/program-app';

export function TrackerPage(): React.ReactNode {
  const { programId } = useParams<{ programId: string }>();
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
  const effectiveProgramId = programId ?? ctxProgramId;

  const programName =
    programsQuery.data?.find((p) => p.id === instanceId)?.name ??
    programsQuery.data?.find((p) => p.status === 'active')?.name ??
    null;

  useEffect(() => {
    document.title = programName
      ? `${programName} — Tracker — Gravity Room`
      : 'Tracker — Gravity Room';
    return () => {
      document.title = DEFAULT_PAGE_TITLE;
    };
  }, [programName]);

  if (!effectiveProgramId) {
    return <Navigate replace to="/app" />;
  }

  const handleBack = (): void => {
    clearTracker();
    navigate('/app');
  };

  const handleReset = (): void => {
    // Keep programId, clear instanceId — re-navigate to same URL without instance
    navigate(`/app/tracker/${effectiveProgramId}`, { replace: true });
  };

  const handleGoToProfile = (): void => {
    navigate('/app/profile');
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
