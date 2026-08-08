import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecentSessionsList } from './recent-sessions-list';

describe('RecentSessionsList', () => {
  it('shows real workout details and completion totals', () => {
    render(
      <RecentSessionsList
        sessions={[
          {
            dateLabel: '30 jul',
            dayIndex: 1,
            dayName: 'Día 1',
            exerciseNames: ['Sentadilla', 'Press banca'],
            successCount: 3,
            totalSets: 3,
          },
        ]}
      />
    );

    expect(screen.getByText('Día 1')).toBeInTheDocument();
    expect(screen.getByText('Sentadilla + Press banca')).toBeInTheDocument();
    expect(screen.getByText('3/3')).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
