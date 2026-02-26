import { useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { Dashboard } from './dashboard';
import { ProgramApp } from './program-app';
import { ProfilePage } from './profile-page';
import { AppSkeleton } from './app-skeleton';

type View = 'dashboard' | 'tracker' | 'profile';

const VALID_VIEWS: ReadonlySet<string> = new Set(['dashboard', 'tracker', 'profile']);

const VIEW_ORDER: Record<View, number> = { dashboard: 0, tracker: 1, profile: 2 };

function isView(value: string): value is View {
  return VALID_VIEWS.has(value);
}

function parseViewParam(param: string | null): View {
  if (param && isView(param)) return param;
  // Legacy: ?view=programs maps to dashboard
  return 'dashboard';
}

export function AppShell(): React.ReactNode {
  const { loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [view, setViewState] = useState<View>(() => parseViewParam(searchParams.get('view')));
  const prevViewRef = useRef<View>(view);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | undefined>(undefined);
  const [selectedProgramId, setSelectedProgramId] = useState<string | undefined>(undefined);
  const [pendingProgramId, setPendingProgramId] = useState<string | undefined>(undefined);

  const setView = (next: View): void => {
    prevViewRef.current = view;
    setViewState(next);
    navigate(next === 'dashboard' ? '/app' : `/app?view=${next}`, { replace: true });
  };

  const clearSelection = (): void => {
    setSelectedInstanceId(undefined);
    setSelectedProgramId(undefined);
    setPendingProgramId(undefined);
  };

  const handleStartNewProgram = (programId: string): void => {
    setSelectedInstanceId(undefined);
    setSelectedProgramId(programId);
    setPendingProgramId(programId);
    setView('tracker');
  };

  const handleContinueProgram = (instanceId: string, programId: string): void => {
    setSelectedInstanceId(instanceId);
    setSelectedProgramId(programId);
    setPendingProgramId(undefined);
    setView('tracker');
  };

  const handleBackToDashboard = (): void => {
    clearSelection();
    setView('dashboard');
  };

  const handleGoToProfile = (): void => {
    setView('profile');
  };

  // URL guard: redirect to dashboard if tracker view is reached with no program selected
  useEffect(() => {
    if (view === 'tracker' && !pendingProgramId && !selectedProgramId) {
      setView('dashboard');
    }
  }, [view, pendingProgramId, selectedProgramId]);

  if (authLoading) return <AppSkeleton />;

  let content: React.ReactNode;

  if (view === 'profile') {
    content = (
      <ProfilePage
        programId={selectedProgramId}
        instanceId={selectedInstanceId}
        onBack={handleBackToDashboard}
      />
    );
  } else if (view === 'dashboard') {
    content = (
      <Dashboard
        onStartNewProgram={handleStartNewProgram}
        onContinueProgram={handleContinueProgram}
        onGoToProfile={handleGoToProfile}
      />
    );
  } else {
    const programId = pendingProgramId ?? selectedProgramId;

    content = programId ? (
      <ProgramApp
        programId={programId}
        instanceId={selectedInstanceId}
        onBackToDashboard={handleBackToDashboard}
        onGoToProfile={handleGoToProfile}
      />
    ) : null;
  }

  const slideDirection = VIEW_ORDER[view] >= VIEW_ORDER[prevViewRef.current] ? 'Right' : 'Left';

  return (
    <div key={view} className={`animate-[slideInFrom${slideDirection}_0.2s_ease-out]`}>
      {content}
    </div>
  );
}
