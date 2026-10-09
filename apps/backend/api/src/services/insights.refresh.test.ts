/**
 * On-read refresh: a stale snapshot is recomputed before the read, a fresh one
 * is left alone, and a failed refresh never fails the read.
 */
process.env['LOG_LEVEL'] = 'silent';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockHasStaleInsights, mockComputeUser } = vi.hoisted(() => ({
  mockHasStaleInsights: vi.fn<(userId: string) => Promise<boolean>>(),
  mockComputeUser: vi.fn<(userId: string) => Promise<void>>(),
}));

vi.mock('../analytics/queries', () => ({
  META_INSIGHT_TYPE: '_meta',
  hasStaleInsights: mockHasStaleInsights,
}));
vi.mock('../analytics/compute', () => ({ computeUser: mockComputeUser }));
vi.mock('../db/rls-context', () => ({ withUserRole: vi.fn() }));

const { refreshStaleInsights } = await import('./insights');

describe('refreshStaleInsights', () => {
  beforeEach(() => {
    mockHasStaleInsights.mockReset();
    mockComputeUser.mockReset();
    mockComputeUser.mockResolvedValue(undefined);
  });

  it('recomputes when the programs changed after the last snapshot', async () => {
    mockHasStaleInsights.mockResolvedValue(true);

    await refreshStaleInsights('u1');

    expect(mockComputeUser).toHaveBeenCalledWith('u1');
  });

  it('does not recompute a fresh snapshot', async () => {
    mockHasStaleInsights.mockResolvedValue(false);

    await refreshStaleInsights('u1');

    expect(mockComputeUser).not.toHaveBeenCalled();
  });

  it('lets the read continue when the refresh fails', async () => {
    mockHasStaleInsights.mockResolvedValue(true);
    mockComputeUser.mockRejectedValue(new Error('lease lost'));

    await expect(refreshStaleInsights('u1')).resolves.toBeUndefined();
  });
});
