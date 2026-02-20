import { useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Dashboard } from './dashboard';
import { GZCLPApp } from './gzclp-app';
import { GenericProgramApp } from './generic-program-app';
import { ProfilePage } from './profile-page';

type View = 'dashboard' | 'tracker' | 'profile';

const VALID_VIEWS: ReadonlySet<string> = new Set(['dashboard', 'tracker', 'profile']);

function isView(value: string): value is View {
  return VALID_VIEWS.has(value);
}

function parseViewParam(param: string | null): View {
  if (param && isView(param)) return param;
  // Legacy: ?view=programs maps to dashboard
  return 'dashboard';
}

export function AppShell(): React.ReactNode {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [view, setViewState] = useState<View>(() => parseViewParam(searchParams.get('view')));
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | undefined>(undefined);
  const [selectedProgramId, setSelectedProgramId] = useState<string | undefined>(undefined);
  const [pendingProgramId, setPendingProgramId] = useState<string | undefined>(undefined);

  const setView = useCallback(
    (next: View): void => {
      setViewState(next);
      navigate(next === 'dashboard' ? '/app' : `/app?view=${next}`, { replace: true });
    },
    [navigate]
  );

  const handleSelectProgram = useCallback(
    (instanceId: string, programId: string): void => {
      setSelectedInstanceId(instanceId);
      setSelectedProgramId(programId);
      setPendingProgramId(undefined);
      setView('tracker');
    },
    [setView]
  );

  const handleStartNewProgram = useCallback(
    (programId: string): void => {
      setSelectedInstanceId(undefined);
      setSelectedProgramId(programId);
      setPendingProgramId(programId);
      setView('tracker');
    },
    [setView]
  );

  const handleContinueProgram = useCallback((): void => {
    // No specific instance — hooks will pick the first active one
    setSelectedInstanceId(undefined);
    setSelectedProgramId(undefined);
    setPendingProgramId(undefined);
    setView('tracker');
  }, [setView]);

  const handleBackToDashboard = useCallback((): void => {
    setSelectedInstanceId(undefined);
    setSelectedProgramId(undefined);
    setPendingProgramId(undefined);
    setView('dashboard');
  }, [setView]);

  const handleGoToProfile = useCallback((): void => {
    setView('profile');
  }, [setView]);

  let content: React.ReactNode;

  if (view === 'profile') {
    content = <ProfilePage onBack={handleBackToDashboard} />;
  } else if (view === 'dashboard') {
    content = (
      <Dashboard
        onSelectProgram={handleSelectProgram}
        onStartNewProgram={handleStartNewProgram}
        onContinueProgram={handleContinueProgram}
        onGoToProfile={handleGoToProfile}
      />
    );
  } else {
    // Determine which program to show
    const programId = pendingProgramId ?? selectedProgramId;

    if (programId && programId !== 'gzclp') {
      content = (
        <GenericProgramApp
          programId={programId}
          instanceId={selectedInstanceId}
          onBackToDashboard={handleBackToDashboard}
          onGoToProfile={handleGoToProfile}
        />
      );
    } else {
      content = (
        <GZCLPApp
          instanceId={selectedInstanceId}
          onBackToDashboard={handleBackToDashboard}
          onGoToProfile={handleGoToProfile}
        />
      );
    }
  }

  return (
    <div key={view} className="animate-[viewFadeIn_0.2s_ease-out]">
      {content}
    </div>
  );
}
