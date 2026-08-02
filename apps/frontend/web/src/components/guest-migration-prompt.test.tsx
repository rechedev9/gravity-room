import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const { state } = vi.hoisted(() => ({
  state: {
    pending: true,
    userEmail: 'signed-in@example.com' as string | null,
    isMigrating: false,
    confirmMigration: vi.fn(() => Promise.resolve()),
    dismissMigration: vi.fn(),
  },
}));

vi.mock('@/hooks/use-guest-migration', () => ({
  useGuestMigration: () => state,
}));

import { GuestMigrationPrompt } from './guest-migration-prompt';

beforeAll(() => {
  if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
  }
});

beforeEach(() => {
  state.pending = true;
  state.userEmail = 'signed-in@example.com';
  state.isMigrating = false;
  state.confirmMigration.mockClear();
  state.dismissMigration.mockClear();
});

describe('GuestMigrationPrompt', () => {
  it('identifies the destination account and explains the transferred training data', () => {
    render(<GuestMigrationPrompt />);

    expect(screen.getByRole('dialog')).toHaveAttribute('open');
    expect(screen.getByText(/ejercicios, pesos, series, repeticiones y resultados/i)).toBeVisible();
    expect(screen.getByText(/signed-in@example.com/)).toBeVisible();
  });

  it('imports only after the user confirms', () => {
    render(<GuestMigrationPrompt />);
    expect(state.confirmMigration).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Importar en esta cuenta' }));

    expect(state.confirmMigration).toHaveBeenCalledOnce();
  });

  it('keeps the local data when the user chooses not now', () => {
    render(<GuestMigrationPrompt />);

    fireEvent.click(screen.getByRole('button', { name: 'Ahora no' }));

    expect(state.dismissMigration).toHaveBeenCalledOnce();
  });
});
