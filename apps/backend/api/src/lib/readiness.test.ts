process.env['LOG_LEVEL'] = 'silent';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbExecute, mockRedisPing, redisState } = vi.hoisted(() => ({
  mockDbExecute: vi.fn(() => Promise.resolve([])),
  mockRedisPing: vi.fn(() => Promise.resolve('PONG')),
  redisState: { enabled: true },
}));

vi.mock('../db', () => ({
  getDb: () => ({ execute: mockDbExecute }),
}));
vi.mock('./redis', () => ({
  getRedis: () => (redisState.enabled ? { ping: mockRedisPing } : undefined),
}));

import { checkReadiness } from './readiness';

beforeEach(() => {
  redisState.enabled = true;
  mockDbExecute.mockReset();
  mockDbExecute.mockImplementation(() => Promise.resolve([]));
  mockRedisPing.mockReset();
  mockRedisPing.mockImplementation(() => Promise.resolve('PONG'));
});

describe('checkReadiness', () => {
  it('reports both dependencies when they are available', async () => {
    const result = await checkReadiness();

    expect(result.status).toBe('ready');
    expect(result.db.status).toBe('ok');
    expect(result.redis.status).toBe('ok');
    expect(mockDbExecute).toHaveBeenCalledTimes(1);
    expect(mockRedisPing).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      dependency: 'database',
      fail: () => mockDbExecute.mockRejectedValueOnce(new Error('db unavailable')),
    },
    {
      dependency: 'redis',
      fail: () => mockRedisPing.mockRejectedValueOnce(new Error('redis unavailable')),
    },
  ])('reports degraded when $dependency fails', async ({ fail }) => {
    fail();

    const result = await checkReadiness();

    expect(result.status).toBe('degraded');
  });

  it('treats intentionally disabled Redis as ready outside production', async () => {
    redisState.enabled = false;

    const result = await checkReadiness();

    expect(result.status).toBe('ready');
    expect(result.redis).toEqual({ status: 'disabled' });
  });
});
