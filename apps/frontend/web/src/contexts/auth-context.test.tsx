import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Mock setup — mock the API modules before importing auth-context.
// vi.mock is hoisted above imports, so every fn the factories/tests reference
// is created via vi.hoisted (and destructured for unchanged usage below).
// ---------------------------------------------------------------------------

const { mockRefreshAccessToken, mockSetAccessToken, mockApiFetch, mockFetchMe } = vi.hoisted(
  () => ({
    mockRefreshAccessToken: vi.fn<() => Promise<{ accessToken: string; user: unknown } | null>>(
      () => Promise.resolve(null)
    ),
    mockSetAccessToken: vi.fn<(token: string | null) => void>(() => {}),
    mockApiFetch: vi.fn<(path: string, options?: RequestInit) => Promise<unknown>>(() =>
      Promise.reject(new Error('Unauthorized'))
    ),
    mockFetchMe: vi.fn<
      () => Promise<{ id: string; email: string; name?: string; avatarUrl?: string } | null>
    >(() => Promise.resolve(null)),
  })
);

vi.mock('@/lib/api', () => ({
  refreshAccessToken: mockRefreshAccessToken,
  setAccessToken: mockSetAccessToken,
  getAccessToken: vi.fn(() => null),
  clearApiResponseCache: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/api-functions', async () => {
  const { apiFunctionsStubs } = await import('../../test/helpers/api-functions-mock');
  return {
    ...apiFunctionsStubs,
    apiFetch: mockApiFetch,
    fetchMe: mockFetchMe,
    parseUserSafe: vi.fn((data: unknown) => {
      if (data && typeof data === 'object' && 'id' in data && 'email' in data) {
        const rec = data as Record<string, unknown>;
        return {
          id: String(rec.id),
          email: String(rec.email),
          name: typeof rec.name === 'string' ? rec.name : undefined,
          avatarUrl: typeof rec.avatarUrl === 'string' ? rec.avatarUrl : undefined,
        };
      }
      return null;
    }),
    // Provide stubs for all other exports used by consumers
    fetchPrograms: vi.fn(() => Promise.resolve([])),
    createProgram: vi.fn(() => Promise.resolve({})),
    updateProgramConfig: vi.fn(() => Promise.resolve()),
    deleteProgram: vi.fn(() => Promise.resolve()),
    undoLastResult: vi.fn(() => Promise.resolve()),
    exportProgram: vi.fn(() => Promise.resolve({})),
    importProgram: vi.fn(() => Promise.resolve({})),
  };
});

import { AuthProvider, useAuth } from './auth-context';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let testQueryClient: QueryClient;

function wrapper({ children }: { readonly children: React.ReactNode }): React.ReactNode {
  return (
    <QueryClientProvider client={testQueryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

function resetAllMocks(): void {
  mockRefreshAccessToken.mockReset();
  mockRefreshAccessToken.mockImplementation(() => Promise.resolve(null));
  mockSetAccessToken.mockReset();
  mockApiFetch.mockReset();
  mockApiFetch.mockImplementation(() => Promise.reject(new Error('Unauthorized')));
  mockFetchMe.mockReset();
  mockFetchMe.mockImplementation(() => Promise.resolve(null));
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
    testQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
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

    it('should restore user from the refresh response in a single round-trip', async () => {
      const token = fakeJwt({ sub: 'user-123', email: 'test@example.com' });
      mockRefreshAccessToken.mockImplementation(() =>
        Promise.resolve({ accessToken: token, user: { id: 'user-123', email: 'test@example.com' } })
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user?.id).toBe('user-123');
      expect(result.current.user?.email).toBe('test@example.com');
      // The user came from /auth/refresh — no follow-up GET /auth/me.
      expect(mockFetchMe).not.toHaveBeenCalled();
    });

    it('should fall back to GET /auth/me when the refresh response omits the user', async () => {
      const token = fakeJwt({ sub: 'user-123', email: 'test@example.com' });
      mockRefreshAccessToken.mockImplementation(() =>
        Promise.resolve({ accessToken: token, user: undefined })
      );
      mockFetchMe.mockImplementation(() =>
        Promise.resolve({ id: 'user-123', email: 'test@example.com' })
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.user?.id).toBe('user-123');
      expect(mockFetchMe).toHaveBeenCalledTimes(1);
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
      expect(mockSetAccessToken).toHaveBeenCalled();
      await waitFor(() => {
        expect(result.current.user?.id).toBe('user-1');
      });
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
      mockRefreshAccessToken.mockImplementation(() =>
        Promise.resolve({ accessToken: token, user: { id: 'user-1', email: 'a@b.com' } })
      );
      mockApiFetch.mockImplementation((path: string) => {
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
      await waitFor(() => {
        expect(result.current.user).toBeNull();
      });
    });
  });
});
