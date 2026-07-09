import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const { mockNavigate, mockRequestPasswordReset, mockResetPassword } = vi.hoisted(() => ({
  mockNavigate: vi.fn(() => Promise.resolve()),
  mockRequestPasswordReset: vi.fn(() => Promise.resolve({ ok: false, code: 'NETWORK_ERROR' })),
  mockResetPassword: vi.fn(() => Promise.resolve({ ok: false, code: 'INVALID_TOKEN' })),
}));

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    requestPasswordReset: mockRequestPasswordReset,
    resetPassword: mockResetPassword,
  }),
}));

vi.mock('@/hooks/use-head', () => ({
  useHead: vi.fn(),
}));

import { ResetPasswordPage } from './auth-flows';

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockRequestPasswordReset.mockReset();
    mockRequestPasswordReset.mockImplementation(() =>
      Promise.resolve({ ok: false, code: 'NETWORK_ERROR' })
    );
    mockResetPassword.mockReset();
    mockResetPassword.mockImplementation(() =>
      Promise.resolve({ ok: false, code: 'INVALID_TOKEN' })
    );
    window.history.replaceState({}, '', '/reset-password');
  });

  it('does not show a false success state when the reset request fails', async () => {
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText('tu@ejemplo.com'), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar enlace' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo conectar con el servidor'
    );
    expect(screen.queryByText(/te hemos enviado un enlace/i)).not.toBeInTheDocument();
  });

  it('shows the API error for an invalid password-reset token', async () => {
    window.history.replaceState({}, '', '/reset-password?token=expired-token');
    render(<ResetPasswordPage />);

    fireEvent.change(screen.getByPlaceholderText('Tu nueva contraseña'), {
      target: { value: 'valid-password-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este enlace no es válido o ha caducado'
    );
  });
});
