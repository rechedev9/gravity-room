import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { InsightItem } from '@/lib/api-functions';
import { FrequencyCard } from './frequency-card';

function insight(payload: unknown): InsightItem {
  return {
    insightType: 'frequency',
    exerciseId: null,
    payload,
    computedAt: '2026-07-26T08:00:00.000Z',
    validUntil: null,
  };
}

describe('FrequencyCard', () => {
  it('can recover from an invalid payload without changing its hook order', () => {
    const view = render(<FrequencyCard insight={insight({})} />);

    expect(() =>
      view.rerender(
        <FrequencyCard
          insight={insight({
            sessionsPerWeek: 3,
            currentStreak: 2,
            consistencyPct: 75,
            totalSessions: 9,
            workoutDates: ['2026-07-25'],
          })}
        />
      )
    ).not.toThrow();

    expect(screen.getByText(/9 sesiones totales/i)).toBeInTheDocument();
  });
});
