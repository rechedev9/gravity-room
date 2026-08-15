import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';
import { createElement } from 'react';

// HomePage pulls in a lot of surrounding dashboard machinery (mentor tour
// widget, PR road, real react-query fetching). This test isolates the one
// contract in scope: a pristine user sees the day-one message exactly once,
// with no dead-end second card, while a non-pristine user still gets the KPI
// strip untouched.

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { readonly children: React.ReactNode; readonly to: string }) =>
    createElement('a', { href: to }, children),
}));

vi.mock('@/hooks/use-document-title', () => ({
  useDocumentTitle: () => undefined,
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: { id: 'home-page-test-user' } }),
}));

vi.mock('@/contexts/guest-context', () => ({
  useGuest: () => ({ isGuest: false }),
}));

const { programsQueryState } = vi.hoisted(() => ({
  programsQueryState: {
    data: [
      { id: 'inst-1', programId: 'gzclp', name: 'GZCLP', status: 'active' as const },
    ] as ReadonlyArray<{ id: string; programId: string; name: string; status: string }>,
    isLoading: false,
    isError: false,
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ ...programsQueryState, refetch: vi.fn() }),
}));

const { dashboardDataState } = vi.hoisted(() => ({
  dashboardDataState: {
    isLoading: false,
    isError: false,
    hero: {} as Record<string, unknown>,
    recentSessions: [] as unknown[],
    liftHistory: [] as unknown[],
    workoutDates: [] as string[],
    currentStreak: 0,
    totalSessions: 0,
    totalWorkouts: 5,
  },
}));

vi.mock('@/features/dashboard/use-dashboard-data', () => ({
  useDashboardData: () => ({ ...dashboardDataState, refetch: vi.fn() }),
}));

vi.mock('@/features/dashboard/use-pr-road', () => ({
  usePrRoad: () => [],
}));

// The mentor widget and zone hint pull in localStorage-backed tour state and
// motion primitives unrelated to this contract; stub them to keep the test
// focused (their own behavior is covered by their colocated tests).
vi.mock('./home-mentor-widget', () => ({
  HomeMentorWidget: () => null,
}));
vi.mock('./zone-hint', () => ({
  ZoneHint: () => null,
}));

const { HomePage } = await import('./home-page');

describe('HomePage pristine vs. non-pristine dashboard', () => {
  beforeEach(() => {
    dashboardDataState.hero = {};
    dashboardDataState.recentSessions = [];
    dashboardDataState.liftHistory = [];
    dashboardDataState.workoutDates = [];
    dashboardDataState.currentStreak = 0;
    dashboardDataState.totalSessions = 0;
    dashboardDataState.totalWorkouts = 5;
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the day-one message exactly once and no dead-end pristine card', () => {
    render(createElement(HomePage));

    // Hero's day-one heading renders (from NextSetHero's DayOneHero state).
    const dayOneHeadings = screen.getAllByText('DÍA UNO');
    expect(dayOneHeadings).toHaveLength(1);

    // The old redundant pristine KPI card (no CTA) must be gone.
    expect(screen.queryByText('SIN SESIONES TODAVÍA')).not.toBeInTheDocument();
    expect(screen.queryByText('TU PRIMERA SESIÓN TE ESPERA')).not.toBeInTheDocument();

    // The hero's own CTA is still the single way forward.
    expect(screen.getByText('EMPEZAR ENTRENAMIENTO')).toBeInTheDocument();
  });

  it('still renders the KPI strip once there is at least one session', () => {
    dashboardDataState.totalSessions = 3;
    dashboardDataState.currentStreak = 1;

    render(createElement(HomePage));

    expect(screen.getByText('RACHA')).toBeInTheDocument();
    expect(screen.getByText('SESIONES')).toBeInTheDocument();
    expect(screen.queryByText('SIN SESIONES TODAVÍA')).not.toBeInTheDocument();
  });
});
