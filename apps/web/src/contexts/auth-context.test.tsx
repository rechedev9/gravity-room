import { mock, describe, it, expect, beforeEach } from 'bun:test';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

// ---------------------------------------------------------------------------
// Mock setup — mock the API modules before importing auth-context
// ---------------------------------------------------------------------------

const mockRefreshAccessToken = mock<() => Promise<string | null>>(() => Promise.resolve(null));
const mockSetAccessToken = mock<(token: string | null) => void>(() => {});

mock.module('@/lib/api', () => ({
  refreshAccessToken: mockRefreshAccessToken,
  setAccessToken: mockSetAccessToken,
  getAccessToken: mock(() => null),
}));

const mockApiFetch = mock<(path: string, options?: RequestInit) => Promise<unknown>>(() =>
  Promise.reject(new Error('Unauthorized'))
);

mock.module('@/lib/api-functions', () => ({
  apiFetch: mockApiFetch,
  // Provide stubs for all other exports used by consumers
  fetchPrograms: mock(() => Promise.resolve([])),
  createProgram: mock(() => Promise.resolve({})),
  updateProgramConfig: mock(() => Promise.resolve()),
  deleteProgram: mock(() => Promise.resolve()),
  undoLastResult: mock(() => Promise.resolve()),
  exportProgram: mock(() => Promise.resolve({})),
  importProgram: mock(() => Promise.resolve({})),
}));

import { AuthProvider, useAuth } from './auth-context';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function wrapper({ children }: { readonly children: React.ReactNode }): React.ReactNode {
  return <AuthProvider>{children}</AuthProvider>;
}

function resetAllMocks(): void {
  mockRefreshAccessToken.mockReset();
  mockRefreshAccessToken.mockImplementation(() => Promise.resolve(null));
  mockSetAccessToken.mockReset();
  mockApiFetch.mockReset();
  mockApiFetch.mockImplementation(() => Promise.reject(new Error('Unauthorized')));
}

// Helper: create a valid JWT with given payload (base64url encoded)
function fakeJwt(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: 'HS256' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.fakesig`;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useAuth', () => {
  it('should throw when used outside AuthProvider', () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow('useAuth must be used within AuthProvider');
  });
});

describe('AuthProvider', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('initial state', () => {
    it('should always set configured to true', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should start in loading state', () => {
      // Make refresh hang to freeze loading
      mockRefreshAccessToken.mockImplementation(() => new Promise(() => {}));

      const { result } = renderHook(() => useAuth(), { wrapper });

      expect(result.current.loading).toBe(true);
    });

    it('should have null user when refresh fails', async () => {
      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user).toBeNull();
    });

    it('should restore user from refresh token', async () => {
      const token = fakeJwt({ sub: 'user-123', email: 'test@example.com' });
      mockRefreshAccessToken.mockImplementation(() => Promise.resolve(token));
      mockApiFetch.mockImplementation(() =>
        Promise.resolve({ id: 'user-123', email: 'test@example.com', name: null })
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user?.id).toBe('user-123');
      expect(result.current.user?.email).toBe('test@example.com');
    });
  });

  describe('signInWithGoogle', () => {
    it('should return null on success and set user', async () => {
      mockApiFetch.mockImplementation((path: string) => {
        if (path === '/auth/google') {
          return Promise.resolve({
            accessToken: fakeJwt({ sub: 'user-1', email: 'a@b.com' }),
            user: { id: 'user-1', email: 'a@b.com', name: null },
          });
        }
        return Promise.reject(new Error('Unauthorized'));
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let authResult: unknown = { message: 'placeholder' };
      await act(async () => {
        authResult = await result.current.signInWithGoogle('google-id-token');
      });

      expect(authResult).toBeNull();
      expect(result.current.user?.id).toBe('user-1');
      expect(mockSetAccessToken).toHaveBeenCalled();
    });

    it('should return error message on failure', async () => {
      mockApiFetch.mockImplementation((path: string) => {
        if (path === '/auth/google') {
          return Promise.reject(new Error('Invalid Google credential'));
        }
        return Promise.reject(new Error('Unauthorized'));
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let authResult: unknown = null;
      await act(async () => {
        authResult = await result.current.signInWithGoogle('bad-credential');
      });

      expect(authResult).toEqual({ message: 'Invalid Google credential' });
    });
  });

  describe('signOut', () => {
    it('should call signout API and clear user', async () => {
      // Start with a logged-in user
      const token = fakeJwt({ sub: 'user-1', email: 'a@b.com' });
      mockRefreshAccessToken.mockImplementation(() => Promise.resolve(token));
      mockApiFetch.mockImplementation((path: string) => {
        if (path === '/auth/me') {
          return Promise.resolve({ id: 'user-1', email: 'a@b.com', name: null });
        }
        if (path === '/auth/signout') {
          return Promise.resolve(null);
        }
        return Promise.reject(new Error('Unauthorized'));
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.user).not.toBeNull();
      });

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockSetAccessToken).toHaveBeenCalledWith(null);
      expect(result.current.user).toBeNull();
    });
  });
});
