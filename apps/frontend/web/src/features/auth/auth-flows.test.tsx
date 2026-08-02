import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const { mockNavigate, mockRequestPasswordReset, mockResetPassword, mockVerifyEmail } = vi.hoisted(
  () => ({
    mockNavigate: vi.fn(() => Promise.resolve()),
    mockRequestPasswordReset: vi.fn(() => Promise.resolve({ ok: false, code: 'NETWORK_ERROR' })),
    mockResetPassword: vi.fn(() => Promise.resolve({ ok: false, code: 'INVALID_TOKEN' })),
    mockVerifyEmail: vi.fn<
      (token: string) => Promise<{ readonly ok: boolean; readonly code?: string }>
    >(() => Promise.resolve({ ok: false, code: 'NETWORK_ERROR' })),
  })
);

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('@/contexts/auth-context', () => ({
  useAuth: () => ({
    requestPasswordReset: mockRequestPasswordReset,
    resetPassword: mockResetPassword,
    verifyEmail: mockVerifyEmail,
  }),
}));

vi.mock('@/hooks/use-head', () => ({
  useHead: vi.fn(),
}));

import { getActionToken } from '@/lib/action-url';
import { ResetPasswordPage, VerifyEmailPage } from './auth-flows';

describe('VerifyEmailPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockVerifyEmail.mockReset();
    window.history.replaceState({}, '', '/verify-email');
  });

  it.each([
    { outcome: 'success', result: { ok: true }, tokenRetained: false },
    {
      outcome: 'definitive invalid or expired response',
      result: { ok: false, code: 'INVALID_TOKEN' },
      tokenRetained: false,
    },
    {
      outcome: 'network failure',
      result: { ok: false, code: 'NETWORK_ERROR' },
      tokenRetained: true,
    },
    {
      outcome: 'rate limit',
      result: { ok: false, code: 'RATE_LIMITED' },
      tokenRetained: true,
    },
    {
      outcome: 'server failure',
      result: { ok: false, code: 'INTERNAL_SERVER_ERROR' },
      tokenRetained: true,
    },
  ])(
    'retains the verification token=$tokenRetained after $outcome',
    async ({ result, tokenRetained }) => {
      mockVerifyEmail.mockResolvedValue(result);
      window.history.replaceState({}, '', '/verify-email?token=verification-secret');

      render(<VerifyEmailPage />);

      expect(window.location.search).toBe('');
      expect(window.location.href).not.toContain('verification-secret');
      await screen.findByRole('alert');
      expect(mockVerifyEmail).toHaveBeenCalledWith('verification-secret');
      expect(getActionToken('/verify-email')).toBe(tokenRetained ? 'verification-secret' : null);
    }
  );
});

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

    expect(window.location.pathname).toBe('/reset-password');
    expect(window.location.search).toBe('');
    expect(window.location.href).not.toContain('expired-token');

    fireEvent.change(screen.getByPlaceholderText('Tu nueva contraseña'), {
      target: { value: 'valid-password-123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Actualizar contraseña' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Este enlace no es válido o ha caducado'
    );
    expect(mockResetPassword).toHaveBeenCalledWith('expired-token', 'valid-password-123');
  });
});
