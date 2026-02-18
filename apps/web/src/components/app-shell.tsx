import { useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Dashboard } from './dashboard';
import { GZCLPApp } from './gzclp-app';
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

  const setView = useCallback(
    (next: View): void => {
      setViewState(next);
      navigate(next === 'dashboard' ? '/app' : `/app?view=${next}`, { replace: true });
    },
    [navigate]
  );

  // Only GZCLP is supported — programId will route to different trackers in the future
  const handleGoToTracker = useCallback((): void => {
    setView('tracker');
  }, [setView]);

  const handleBackToDashboard = useCallback((): void => {
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
        onSelectProgram={handleGoToTracker}
        onContinueProgram={handleGoToTracker}
        onGoToProfile={handleGoToProfile}
      />
    );
  } else {
    content = (
      <GZCLPApp onBackToDashboard={handleBackToDashboard} onGoToProfile={handleGoToProfile} />
    );
  }

  return (
    <div key={view} className="animate-[viewFadeIn_0.2s_ease-out]">
      {content}
    </div>
  );
}
