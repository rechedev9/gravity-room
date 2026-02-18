import { mock, describe, it, expect, beforeEach } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DEFAULT_WEIGHTS } from '../../test/helpers/fixtures';
import type { ProgramSummary, ProgramDetail } from '@/lib/api-functions';
import type { UserInfo } from '@/contexts/auth-context';

// ---------------------------------------------------------------------------
// Mock setup
// ---------------------------------------------------------------------------

const mockFetchPrograms = mock<() => Promise<ProgramSummary[]>>(() => Promise.resolve([]));
const mockFetchProgram = mock<(id: string) => Promise<ProgramDetail>>(() =>
  Promise.resolve({
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
  })
);

const mockImportProgram = mock(() => Promise.resolve({ id: 'imported-1' }));

mock.module('@/lib/api-functions', () => ({
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

const mockUseAuth = mock(() => ({
  user: { id: 'user-1', email: 'test@test.com' } as UserInfo | null,
  loading: false,
  configured: true,
  signIn: mock(() => Promise.resolve(null)),
  signUp: mock(() => Promise.resolve(null)),
  signInWithGoogle: mock(() => Promise.resolve(null)),
  signOut: mock(() => Promise.resolve()),
}));

mock.module('@/contexts/auth-context', () => ({
  useAuth: mockUseAuth,
}));

import { useProgram } from './use-program';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createWrapper(): React.FC<{ readonly children: React.ReactNode }> {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return function Wrapper({ children }: { readonly children: React.ReactNode }): React.ReactNode {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useProgram', () => {
  beforeEach(() => {
    mockFetchPrograms.mockReset();
    mockFetchPrograms.mockImplementation(() => Promise.resolve([]));
    mockFetchProgram.mockReset();
    mockFetchProgram.mockImplementation(() =>
      Promise.resolve({
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
      })
    );
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
      mockFetchPrograms.mockImplementation(() =>
        Promise.resolve([
          {
            id: 'inst-1',
            programId: 'gzclp',
            name: 'GZCLP',
            config: { ...DEFAULT_WEIGHTS },
            status: 'active',
            createdAt: '2025-01-01',
            updatedAt: '2025-01-01',
          },
        ])
      );
      mockFetchProgram.mockImplementation(() =>
        Promise.resolve({
          id: 'inst-1',
          programId: 'gzclp',
          name: 'GZCLP',
          config: { ...DEFAULT_WEIGHTS },
          status: 'active',
          createdAt: '2025-01-01',
          updatedAt: '2025-01-01',
          startWeights: DEFAULT_WEIGHTS,
          results: { 0: { t1: 'success' } },
          undoHistory: [],
        })
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
      mockUseAuth.mockImplementation(() => ({
        user: null as UserInfo | null,
        loading: false,
        configured: true,
        signIn: mock(() => Promise.resolve(null)),
        signUp: mock(() => Promise.resolve(null)),
        signInWithGoogle: mock(() => Promise.resolve(null)),
        signOut: mock(() => Promise.resolve()),
      }));

      const wrapper = createWrapper();
      const { result } = renderHook(() => useProgram(), { wrapper });

      // Give it time to potentially fetch
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(result.current.startWeights).toBeNull();
      expect(mockFetchPrograms).not.toHaveBeenCalled();

      // Reset mock
      mockUseAuth.mockImplementation(() => ({
        user: { id: 'user-1', email: 'test@test.com' } as UserInfo | null,
        loading: false,
        configured: true,
        signIn: mock(() => Promise.resolve(null)),
        signUp: mock(() => Promise.resolve(null)),
        signInWithGoogle: mock(() => Promise.resolve(null)),
        signOut: mock(() => Promise.resolve()),
      }));
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

      // Restore the mock
      mockImportProgram.mockImplementation(() => Promise.resolve({ id: 'imported-1' }));
    });

    it('returns false for malformed JSON', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProgram(), { wrapper });

      const outcome = await result.current.importData('not json');
      expect(outcome).toBe(false);
    });
  });
});
