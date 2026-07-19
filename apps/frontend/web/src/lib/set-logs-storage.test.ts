import { afterEach, describe, expect, it } from 'vitest';
import {
  buildSetLogsStorageKey,
  clearStoredSetLogs,
  restoreSetLogs,
  saveSetLogs,
} from './set-logs-storage';
import type { SetLogEntry } from '@gzclp/domain/types';

afterEach(() => {
  localStorage.clear();
});

describe('buildSetLogsStorageKey', () => {
  it('scopes the key by owner, program, and instance', () => {
    const key = buildSetLogsStorageKey({
      userId: 'user-1',
      programId: 'gzclp',
      instanceId: 'inst-9',
    });
    expect(key).toBe('gravity-room:set-logs|user-1|gzclp|inst-9');
  });

  it('uses a dedicated guest owner when userId is null', () => {
    const key = buildSetLogsStorageKey({ userId: null, programId: 'gzclp' });
    expect(key).toBe('gravity-room:set-logs|guest|gzclp|default');
  });

  it('never collides across users, guest, or program instances', () => {
    const authed = buildSetLogsStorageKey({ userId: 'a', programId: 'p', instanceId: 'i' });
    const otherUser = buildSetLogsStorageKey({ userId: 'b', programId: 'p', instanceId: 'i' });
    const guest = buildSetLogsStorageKey({ userId: null, programId: 'p', instanceId: 'i' });
    const otherInstance = buildSetLogsStorageKey({ userId: 'a', programId: 'p', instanceId: 'j' });

    const keys = new Set([authed, otherUser, guest, otherInstance]);
    expect(keys.size).toBe(4);
  });
});

describe('saveSetLogs / restoreSetLogs', () => {
  const KEY = 'gravity-room:set-logs|user-1|gzclp|default';

  function map(
    entries: readonly (readonly [string, readonly SetLogEntry[]])[]
  ): Map<string, readonly SetLogEntry[]> {
    return new Map(entries);
  }

  it('round-trips a set-log map including weight and rpe', () => {
    const logs = map([
      [
        '0:d1-t1',
        [
          { reps: 3, weight: 60, rpe: 8 },
          { reps: 3, weight: 60 },
        ],
      ],
      ['0:d1-t2', [{ reps: 10 }]],
    ]);

    saveSetLogs(KEY, logs);
    const restored = restoreSetLogs(KEY);

    expect(restored.get('0:d1-t1')).toEqual([
      { reps: 3, weight: 60, rpe: 8 },
      { reps: 3, weight: 60 },
    ]);
    expect(restored.get('0:d1-t2')).toEqual([{ reps: 10 }]);
  });

  it('returns an empty map when nothing is stored', () => {
    expect(restoreSetLogs(KEY).size).toBe(0);
  });

  it('removes the key when saving an empty map (completed / reset day)', () => {
    saveSetLogs(KEY, map([['0:d1-t1', [{ reps: 3 }]]]));
    expect(localStorage.getItem(KEY)).not.toBeNull();

    saveSetLogs(KEY, new Map());
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(restoreSetLogs(KEY).size).toBe(0);
  });

  it('does not leak between two users on the same browser', () => {
    const keyA = buildSetLogsStorageKey({ userId: 'a', programId: 'gzclp' });
    const keyB = buildSetLogsStorageKey({ userId: 'b', programId: 'gzclp' });

    saveSetLogs(keyA, map([['0:d1-t1', [{ reps: 5 }]]]));

    expect(restoreSetLogs(keyB).size).toBe(0);
    expect(restoreSetLogs(keyA).get('0:d1-t1')).toEqual([{ reps: 5 }]);
  });

  it('does not leak between guest and authenticated sessions', () => {
    const guestKey = buildSetLogsStorageKey({ userId: null, programId: 'gzclp' });
    const userKey = buildSetLogsStorageKey({ userId: 'u', programId: 'gzclp' });

    saveSetLogs(guestKey, map([['0:d1-t1', [{ reps: 7 }]]]));

    expect(restoreSetLogs(userKey).size).toBe(0);
  });

  it('ignores malformed payloads instead of throwing', () => {
    localStorage.setItem(KEY, 'not json');
    expect(restoreSetLogs(KEY).size).toBe(0);

    localStorage.setItem(KEY, JSON.stringify({ not: 'an array' }));
    expect(restoreSetLogs(KEY).size).toBe(0);
  });

  it('drops malformed entries and empty slots while keeping valid ones', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        ['0:d1-t1', [{ reps: 3 }]],
        ['0:d1-t2', [{ reps: 'oops' }]], // invalid reps → whole slot dropped
        ['0:d1-t3', []], // empty logs → dropped
        [42, [{ reps: 1 }]], // non-string key → skipped
        ['bad-pair'], // wrong tuple shape → skipped
      ])
    );

    const restored = restoreSetLogs(KEY);
    expect([...restored.keys()]).toEqual(['0:d1-t1']);
    expect(restored.get('0:d1-t1')).toEqual([{ reps: 3 }]);
  });

  it('strips non-finite weight and rpe fields', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([['0:d1-t1', [{ reps: 3, weight: Number.NaN, rpe: 8 }]]])
    );

    // NaN serializes to null in JSON, which is rejected → field dropped.
    expect(restoreSetLogs(KEY).get('0:d1-t1')).toEqual([{ reps: 3, rpe: 8 }]);
  });
});

describe('clearStoredSetLogs', () => {
  it('removes any persisted map for a key', () => {
    const key = buildSetLogsStorageKey({ userId: 'u', programId: 'gzclp' });
    saveSetLogs(key, new Map([['0:d1-t1', [{ reps: 3 }]]]));

    clearStoredSetLogs(key);

    expect(restoreSetLogs(key).size).toBe(0);
    expect(localStorage.getItem(key)).toBeNull();
  });
});
