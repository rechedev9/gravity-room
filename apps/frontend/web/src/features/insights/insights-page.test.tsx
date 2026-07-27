import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { InsightItem } from '@/lib/api-functions';

interface QueryState {
  data: InsightItem[];
  isLoading: boolean;
  isError: boolean;
}

const { refetch, state } = vi.hoisted(
  (): { refetch: ReturnType<typeof vi.fn>; state: QueryState } => ({
    refetch: vi.fn(),
    state: {
      data: [],
      isLoading: false,
      isError: false,
    },
  })
);

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ ...state, refetch }),
}));
vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({ user: { id: 'qa4-insights-user' } }),
}));
vi.mock('@/hooks/use-document-title', () => ({
  useDocumentTitle: () => undefined,
}));
vi.mock('@/lib/lazy-with-retry', () => ({
  lazyWithRetry: () => () => null,
}));

const { InsightsPage } = await import('./insights-page');

function item(
  insightType: string,
  payload: unknown,
  computedAt = '2026-07-26T08:00:00.000Z'
): InsightItem {
  return { insightType, exerciseId: null, payload, computedAt, validUntil: null };
}

describe('InsightsPage query states', () => {
  beforeEach(() => {
    state.data = [];
    state.isLoading = false;
    state.isError = false;
    refetch.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-26T12:00:00.000Z'));
  });

  it('renders a recoverable error instead of misreporting an empty account', () => {
    state.isError = true;
    render(<InsightsPage />);

    expect(screen.getByRole('alert')).toHaveTextContent('Análisis no disponible');
    expect(screen.queryByText('Sin análisis todavía')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('does not leave a loading shimmer behind when settled partial data has no volume trend', () => {
    state.data = [
      item('frequency', {
        sessionsPerWeek: 2,
        currentStreak: 1,
        consistencyPct: 60,
        totalSessions: 8,
        workoutDates: ['2026-07-25'],
      }),
    ];
    const { container } = render(<InsightsPage />);

    expect(screen.getByText(/8 sesiones totales/i)).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).not.toBeInTheDocument();
  });

  it('labels older data with its actual date instead of claiming it was updated today', () => {
    state.data = [
      item(
        'frequency',
        {
          sessionsPerWeek: 2,
          currentStreak: 1,
          consistencyPct: 60,
          totalSessions: 8,
        },
        '2026-07-20T08:00:00.000Z'
      ),
      // This newer row is rejected by its payload guard and must not make the
      // visible, older frequency insight look fresh.
      item(
        'volume_trend',
        { weeks: ['2026-W30'], volumes: [], slope: 0, direction: 'flat' },
        '2026-07-26T08:00:00.000Z'
      ),
    ];
    render(<InsightsPage />);

    expect(screen.queryByText('ACTUALIZADO HOY')).not.toBeInTheDocument();
    const timestamp = document.querySelector('time');
    expect(timestamp).toHaveAttribute('datetime', '2026-07-20T08:00:00.000Z');
    const localizedDate = new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(
      new Date('2026-07-20T08:00:00.000Z')
    );
    expect(timestamp).toHaveTextContent(`ACTUALIZADO ${localizedDate}`);
  });

  it('treats malformed rows as unavailable rather than rendering undefined metrics', () => {
    state.data = [
      item('frequency', {
        sessionsPerWeek: 2,
        currentStreak: 1,
        consistencyPct: 60,
      }),
    ];
    render(<InsightsPage />);

    expect(screen.getByText('Sin análisis todavía')).toBeInTheDocument();
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });
});
