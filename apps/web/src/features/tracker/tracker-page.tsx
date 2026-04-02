import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useTracker } from '@/contexts/tracker-context';
import { ProgramApp } from '@/features/tracker/program-app';

export function TrackerPage(): React.ReactNode {
  const { programId } = useParams<{ programId: string }>();
  const { instanceId, programId: ctxProgramId, clearTracker } = useTracker();
  const navigate = useNavigate();

  // Fallback to context programId when URL param is absent
  const effectiveProgramId = programId ?? ctxProgramId;

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
