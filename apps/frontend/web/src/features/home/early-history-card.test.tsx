import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EarlyHistoryCard } from './early-history-card';

describe('EarlyHistoryCard', () => {
  it('shows the next dashboard milestones and current progress', () => {
    render(<EarlyHistoryCard completedSessions={1} />);

    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
    expect(screen.getByText(/1 de 3|1 of 3/i)).toBeInTheDocument();
    expect(screen.getByText(/ruta al PR|road to PR/i)).toBeInTheDocument();
    expect(screen.getByText(/mapa de constancia|consistency map/i)).toBeInTheDocument();
  });
});
