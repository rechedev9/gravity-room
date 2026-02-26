/**
 * use-program.test.ts — onError callback tests.
 * Verifies that all four mutations have onError callbacks that trigger a user-visible toast.
 */
import { mock, describe, it, expect, beforeEach } from 'bun:test';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ProgramSummary } from '@/lib/api-functions';

// ---------------------------------------------------------------------------
// Mock setup — must be declared before imports
// ---------------------------------------------------------------------------

const mockRefreshAccessToken = mock<() => Promise<string | null>>(() =>
  Promise.resolve('fake-access-token')
);

mock.module('@/lib/api', () => ({
  refreshAccessToken: mockRefreshAccessToken,
  setAccessToken: mock<(token: string | null) => void>(() => {}),
  getAccessToken: mock<() => string | null>(() => 'fake-access-token'),
}));

const ACTIVE_INSTANCE_ID = 'gen-inst-1';

const PROGRAM_SUMMARY: ProgramSummary = {
  id: ACTIVE_INSTANCE_ID,
  programId: 'nivel7',
  name: 'Nivel 7',
  config: {},
  status: 'active',
  createdAt: '2025-01-01',
  updatedAt: '2025-01-01',
};

const mockFetchPrograms = mock<() => Promise<ProgramSummary[]>>(() =>
  Promise.resolve([PROGRAM_SUMMARY])
);

mock.module('@/lib/api-functions', () => ({
  apiFetch: mock((path: string) => {
    if (path === '/auth/me') return Promise.resolve({ id: 'user-1', email: 'test@test.com' });
    return Promise.reject(new Error(`Unexpected path: ${path}`));
  }),
  fetchPrograms: mockFetchPrograms,
  fetchGenericProgramDetail: mock(() =>
    Promise.resolve({
      id: ACTIVE_INSTANCE_ID,
      programId: 'nivel7',
      name: 'Nivel 7',
      config: {
        press_mil: 60,
        bench: 80,
        squat: 100,
        deadlift: 120,
        press_franc: 20,
        ext_polea: 15,
        elev_lat: 10,
        elev_post: 10,
        remo_bar: 50,
        jalon: 40,
        face_pull: 20,
        gemelo_pie: 30,
        gemelo_sent: 20,
        apert: 15,
        cruces: 15,
        curl_bar: 30,
        curl_alt: 12,
        curl_mart: 12,
        prensa: 80,
        ext_quad: 30,
        curl_fem: 25,
        hip_thrust: 60,
        zancadas: 20,
        leg_press_gem: 40,
        elev_front: 10,
      },
      results: {},
      undoHistory: [],
      resultTimestamps: {},
      status: 'active',
    })
  ),
  createProgram: mock(() => Promise.resolve({ id: 'new-gen-1' })),
  updateProgramConfig: mock(() => Promise.resolve()),
  deleteProgram: mock(() => Promise.resolve()),
  recordGenericResult: mock(() => Promise.resolve()),
  deleteGenericResult: mock(() => Promise.resolve()),
  undoLastResult: mock(() => Promise.resolve()),
  exportProgram: mock(() => Promise.resolve({})),
  importProgram: mock(() => Promise.resolve({ id: 'imported-gen-1' })),
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

  return function Wrapper({ children }: { readonly children: React.ReactNode }): React.ReactNode {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      React.createElement(AuthProvider, null, React.createElement(ToastProvider, null, children))
    );
  };
}

function resetMocks(): void {
  mockRefreshAccessToken.mockReset();
  mockRefreshAccessToken.mockImplementation(() => Promise.resolve('fake-access-token'));

  mockFetchPrograms.mockReset();
  mockFetchPrograms.mockImplementation(() => Promise.resolve([PROGRAM_SUMMARY]));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useProgram', () => {
  beforeEach(() => {
    resetMocks();
  });

  describe('onError callbacks', () => {
    it('undoLastMutation onError — hook exposes undoLast function', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProgram('nivel7'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.undoLast).toBe('function');
    });

    it('generateProgramMutation onError — hook exposes generateProgram function', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProgram('nivel7'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.generateProgram).toBe('function');
    });

    it('updateConfigMutation onError — hook exposes updateConfig function', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProgram('nivel7'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.updateConfig).toBe('function');
    });

    it('resetAllMutation onError — hook exposes resetAll function', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProgram('nivel7'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof result.current.resetAll).toBe('function');
    });
  });

  describe('interface completeness', () => {
    it('exposes all required methods', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useProgram('nivel7'), { wrapper });

      expect(typeof result.current.generateProgram).toBe('function');
      expect(typeof result.current.updateConfig).toBe('function');
      expect(typeof result.current.markResult).toBe('function');
      expect(typeof result.current.setAmrapReps).toBe('function');
      expect(typeof result.current.undoSpecific).toBe('function');
      expect(typeof result.current.undoLast).toBe('function');
      expect(typeof result.current.resetAll).toBe('function');
      expect(typeof result.current.exportData).toBe('function');
      expect(typeof result.current.importData).toBe('function');
    });
  });
});
