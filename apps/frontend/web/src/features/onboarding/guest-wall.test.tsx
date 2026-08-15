import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { GuestWall } from './guest-wall';

describe('GuestWall', () => {
  afterEach(cleanup);

  it('states every guest limit up front as a table', () => {
    render(<GuestWall onCreateAccount={vi.fn()} onContinueAsGuest={vi.fn()} />);

    const rows = within(screen.getByRole('table')).getAllByRole('row');
    // Header + one row per capability.
    expect(rows).toHaveLength(6);
    expect(screen.getByText('Estadísticas y gráficas')).toBeInTheDocument();
    expect(screen.getByText('Exportar CSV y copia de seguridad')).toBeInTheDocument();
  });

  it.each([
    { testId: 'start-guest-create-account', handler: 'onCreateAccount' as const },
    { testId: 'start-guest-continue', handler: 'onContinueAsGuest' as const },
  ])('$testId calls $handler', ({ testId, handler }) => {
    const handlers = { onCreateAccount: vi.fn(), onContinueAsGuest: vi.fn() };
    render(<GuestWall {...handlers} />);

    fireEvent.click(screen.getByTestId(testId));
    expect(handlers[handler]).toHaveBeenCalledOnce();
  });
});
