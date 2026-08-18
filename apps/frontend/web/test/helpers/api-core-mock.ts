/**
 * Stub set for `@/lib/api-core` mocks.
 *
 * `api-core.ts` owns the auth-aware fetch wrapper and the profile endpoints;
 * `api-functions.ts` re-exports them. Modules on the pre-paint path (notably
 * `auth-context`) import from `api-core` directly, so a test that only mocks
 * `@/lib/api-functions` will not intercept them — mock both, spreading these
 * stubs so no export is missing.
 *
 * Keep this in lockstep with the real module's runtime export list.
 */
import { vi } from 'vitest';

export const apiCoreStubs = {
  API_URL: 'http://localhost:3001',
  apiFetch: vi.fn(() => Promise.reject(new Error('apiFetch not configured in this test'))),
  extractApiError: vi.fn(() => Promise.reject(new Error('extractApiError not configured'))),
  fetchMe: vi.fn(() => Promise.resolve(null)),
  updateProfile: vi.fn(() => Promise.resolve({})),
  deleteAccount: vi.fn(() => Promise.resolve()),
};
