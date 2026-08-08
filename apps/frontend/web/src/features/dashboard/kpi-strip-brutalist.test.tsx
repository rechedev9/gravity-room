import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { KpiStripBrutalist } from './kpi-strip-brutalist';

describe('KpiStripBrutalist', () => {
  it('uses program progress instead of an empty weekly PR card', () => {
    render(<KpiStripBrutalist streakDays={1} totalSessions={1} totalWorkouts={90} weekPr={null} />);

    expect(screen.getByText('1/90')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });
});
