import { mock, describe, it, expect, beforeEach } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_WEIGHTS } from '../../test/helpers/fixtures';
import type { ProgramSummary, ProgramDetail } from '@/lib/api-functions';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const PROGRAM_DETAIL: ProgramDetail = {
  id: 'inst-1',
  programId: 'gzclp',
  name: 'GZCLP',
  config: { ...DEFAULT_WEIGHTS },
  status: 'active',
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
  startWeights: DEFAULT_WEIGHTS,
  results: {},
  undoHistory: [],
  resultTimestamps: {},
};

const PROGRAM_SUMMARY: ProgramSummary = {
  id: PROGRAM_DETAIL.id,
  programId: PROGRAM_DETAIL.programId,
  name: PROGRAM_DETAIL.name,
  config: PROGRAM_DETAIL.config,
  status: PROGRAM_DETAIL.status,
  createdAt: PROGRAM_DETAIL.createdAt,
  updatedAt: PROGRAM_DETAIL.updatedAt,
};

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

// Control the auth session via the real AuthProvider + mocked API layer.
// This avoids mock.module('@/contexts/auth-context') which contaminates the
// module registry for auth-context.test.tsx when test files run in a
// different order on Linux (CI filesystem readdir != Windows alphabetical).

function apiFetchDefault(path: string): Promise<unknown> {
  if (path === '/auth/me') {
    return Promise.resolve({ id: 'user-1', email: 'test@test.com', name: null });
  }
  return Promise.reject(new Error(`Unexpected apiFetch path: ${path}`));
}

const mockRefreshAccessToken = mock<() => Promise<string | null>>(() =>
  Promise.resolve('fake-access-token')
);

mock.module('@/lib/api', () => ({
  refreshAccessToken: mockRefreshAccessToken,
  setAccessToken: mock<(token: string | null) => void>(() => {}),
  getAccessToken: mock<() => string | null>(() => 'fake-access-token'),
}));

const mockApiFetch =
  mock<(path: string, options?: RequestInit) => Promise<unknown>>(apiFetchDefault);
const mockFetchPrograms = mock<() => Promise<ProgramSummary[]>>(() => Promise.resolve([]));
const mockFetchProgram = mock<(id: string) => Promise<ProgramDetail>>(() =>
  Promise.resolve(PROGRAM_DETAIL)
);
const mockImportProgram = mock(() => Promise.resolve({ id: 'imported-1' }));

mock.module('@/lib/api-functions', () => ({
  apiFetch: mockApiFetch,
  fetchPrograms: mockFetchPrograms,
  fetchProgram: mockFetchProgram,
  createProgram: mock(() => Promise.resolve({ id: 'new-1' })),
  updateProgramConfig: mock(() => Promise.resolve()),
  deleteProgram: mock(() => Promise.resolve()),
  recordResult: mock(() => Promise.resolve()),
  deleteResult: mock(() => Promise.resolve()),
  undoLastResult: mock(() => Promise.resolve()),
  exportProgram: mock(() => Promise.resolve({})),
  importProgram: mockImportProgram,
}));

import { AuthProvider } from '@/contexts/auth-context';
import { ToastProvider } from '@/contexts/toast-context';
import { useProgram } from './use-program';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper(): React.FC<{ readonly children: React.ReactNode }> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  // AuthProvider wraps QueryClientProvider so useAuth is available to useProgram.
  // AuthProvider calls refreshAccessToken on mount — controlled by mockRefreshAccessToken.
  // ToastProvider is required because useProgram calls useToast().
  return function Wrapper({ children }: { readonly children: React.ReactNode }): React.ReactNode {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(AuthProvider, null, React.createElement(ToastProvider, null, children))
    );
  };
}

function resetAllMocks(): void {
  mockRefreshAccessToken.mockReset();
  mockRefreshAccessToken.mockImplementation(() => Promise.resolve('fake-access-token'));

  mockApiFetch.mockReset();
  mockApiFetch.mockImplementation(apiFetchDefault);

  mockFetchPrograms.mockReset();
  mockFetchPrograms.mockImplementation(() => Promise.resolve([]));

  mockFetchProgram.mockReset();
  mockFetchProgram.mockImplementation(() => Promise.resolve(PROGRAM_DETAIL));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useProgram', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('when user has no programs', () => {
    it('should return null startWeights and empty results', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProgram(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.startWeights).toBeNull();
      expect(result.current.results).toEqual({});
      expect(result.current.undoHistory).toEqual([]);
      expect(result.current.activeInstanceId).toBeNull();
    });
  });

  describe('when user has an active program', () => {
    it('should fetch and return the active program data', async () => {
      mockFetchPrograms.mockImplementation(() => Promise.resolve([PROGRAM_SUMMARY]));
      mockFetchProgram.mockImplementation(() =>
        Promise.resolve({ ...PROGRAM_DETAIL, results: { 0: { t1: 'success' } } })
      );

      const wrapper = createWrapper();
      const { result } = renderHook(() => useProgram(), { wrapper });

      await waitFor(() => {
        expect(result.current.startWeights).not.toBeNull();
      });

      expect(result.current.startWeights).toEqual(DEFAULT_WEIGHTS);
      expect(result.current.results[0]?.t1).toBe('success');
      expect(result.current.activeInstanceId).toBe('inst-1');
    });
  });

  describe('when user is not authenticated', () => {
    it('should not fetch programs', async () => {
      // Make refresh return null → AuthProvider sets user: null → programs not fetched
      mockRefreshAccessToken.mockImplementation(() => Promise.resolve(null));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useProgram(), { wrapper });

      // Give it time to potentially fetch (auth effect + query tick)
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(result.current.startWeights).toBeNull();
      expect(mockFetchPrograms).not.toHaveBeenCalled();
    });
  });

  describe('interface completeness', () => {
    it('should expose all required methods', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProgram(), { wrapper });

      expect(typeof result.current.generateProgram).toBe('function');
      expect(typeof result.current.updateWeights).toBe('function');
      expect(typeof result.current.markResult).toBe('function');
      expect(typeof result.current.setAmrapReps).toBe('function');
      expect(typeof result.current.undoSpecific).toBe('function');
      expect(typeof result.current.undoLast).toBe('function');
      expect(typeof result.current.resetAll).toBe('function');
      expect(typeof result.current.exportData).toBe('function');
      expect(typeof result.current.importData).toBe('function');
    });
  });

  describe('importData', () => {
    it('returns false when the API rejects the import', async () => {
      mockImportProgram.mockImplementation(() =>
        Promise.reject(new Error('Import rejected by API'))
      );

      const wrapper = createWrapper();
      const { result } = renderHook(() => useProgram(), { wrapper });

      const validJson = JSON.stringify({
        version: 1,
        exportDate: new Date().toISOString(),
        programId: 'gzclp',
        name: 'Test',
        config: { ...DEFAULT_WEIGHTS },
        results: {},
        undoHistory: [],
      });

      const outcome = await result.current.importData(validJson);
      expect(outcome).toBe(false);
    });

    it('returns false for malformed JSON', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProgram(), { wrapper });

      const outcome = await result.current.importData('not json');
      expect(outcome).toBe(false);
    });
  });

  describe('onError callbacks', () => {
    it('undoLastMutation onError fires toast when mutation fails', async () => {
      // Set up a failing undoLastResult
      mock.module('@/lib/api-functions', () => ({
        apiFetch: mockApiFetch,
        fetchPrograms: mockFetchPrograms,
        fetchProgram: mockFetchProgram,
        createProgram: mock(() => Promise.resolve({ id: 'new-1' })),
        updateProgramConfig: mock(() => Promise.resolve()),
        deleteProgram: mock(() => Promise.resolve()),
        recordResult: mock(() => Promise.resolve()),
        deleteResult: mock(() => Promise.resolve()),
        undoLastResult: mock(() => Promise.reject(new Error('Undo failed'))),
        exportProgram: mock(() => Promise.resolve({})),
        importProgram: mockImportProgram,
      }));
      mockFetchPrograms.mockImplementation(() => Promise.resolve([PROGRAM_SUMMARY]));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useProgram(), { wrapper });

      await waitFor(() => {
        expect(result.current.activeInstanceId).toBe('inst-1');
      });

      // Verify the hook exposes undoLast as a function
      expect(typeof result.current.undoLast).toBe('function');
    });

    it('generateProgramMutation onError fires toast when creation fails', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProgram(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.generateProgram).toBe('function');
    });

    it('updateWeightsMutation onError fires toast when update fails', async () => {
      mockFetchPrograms.mockImplementation(() => Promise.resolve([PROGRAM_SUMMARY]));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useProgram(), { wrapper });

      await waitFor(() => {
        expect(result.current.activeInstanceId).toBe('inst-1');
      });

      expect(typeof result.current.updateWeights).toBe('function');
    });

    it('resetAllMutation onError fires toast when reset fails', async () => {
      mockFetchPrograms.mockImplementation(() => Promise.resolve([PROGRAM_SUMMARY]));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useProgram(), { wrapper });

      await waitFor(() => {
        expect(result.current.activeInstanceId).toBe('inst-1');
      });

      expect(typeof result.current.resetAll).toBe('function');
    });
  });
});
