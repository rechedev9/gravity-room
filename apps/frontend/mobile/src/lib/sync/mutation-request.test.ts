import type { QueuedMutation } from './mutation-queue-repository';
import { buildMutationRequest, InvalidQueuedMutationError } from './mutation-request';

function mutation(overrides: Partial<QueuedMutation> = {}): QueuedMutation {
  return {
    id: 1,
    entityType: 'program-instance',
    entityId: 'instance-1',
    operation: 'record-result',
    payload: { workoutIndex: 0, slotId: 'squat', result: 'success' },
    createdAt: '2026-09-12T00:00:00Z',
    ...overrides,
  };
}

describe('outbox wire requests', () => {
  it.each(['success', 'fail'])('preserves %s result and all domain-owned fields', (result) => {
    const queued = mutation({
      payload: {
        workoutIndex: 12,
        slotId: 'squat',
        result,
        setLogs: [{ reps: 5, weight: 100, rpe: 8 }],
        notes: 'Keep the original notes',
      },
    });
    expect(buildMutationRequest(queued)).toEqual({
      path: '/programs/instance-1/results',
      method: 'POST',
      body: JSON.stringify(queued.payload),
      acceptsNotFound: false,
    });
  });

  it('preserves metadata without introducing app-side training rules', () => {
    const queued = mutation({
      operation: 'update-metadata',
      payload: { metadata: { notes: 'week 2', nested: { value: null }, custom: [1, 2] } },
    });
    expect(buildMutationRequest(queued)).toEqual({
      path: '/programs/instance-1/metadata',
      method: 'PATCH',
      body: JSON.stringify(queued.payload),
      acceptsNotFound: false,
    });
  });

  it('accepts empty metadata and preserves explicit false/null values', () => {
    for (const metadata of [{}, { enabled: false, value: null }]) {
      const request = buildMutationRequest(
        mutation({ operation: 'update-metadata', payload: { metadata } })
      );
      expect(request.body).toBe(JSON.stringify({ metadata }));
    }
  });

  it('creates a bodyless idempotent deletion', () => {
    const request = buildMutationRequest(
      mutation({ operation: 'delete-result', payload: { workoutIndex: 0, slotId: 'squat' } })
    );
    expect(request).toEqual({
      path: '/programs/instance-1/results/0/squat',
      method: 'DELETE',
      acceptsNotFound: true,
    });
    expect(request).not.toHaveProperty('body');
  });

  it('encodes path segments independently without changing the persisted identifiers', () => {
    const queued = mutation({
      entityId: 'plan/a?x=1#fragment',
      operation: 'delete-result',
      payload: { workoutIndex: 7, slotId: 'sentadilla / 🏋️' },
    });
    const original = JSON.stringify(queued);
    expect(buildMutationRequest(queued).path).toBe(
      '/programs/plan%2Fa%3Fx%3D1%23fragment/results/7/sentadilla%20%2F%20%F0%9F%8F%8B%EF%B8%8F'
    );
    expect(JSON.stringify(queued)).toBe(original);
  });

  it('does not trim a valid persisted identifier', () => {
    expect(buildMutationRequest(mutation({ entityId: ' plan ' })).path).toBe(
      '/programs/%20plan%20/results'
    );
  });

  it.each<Partial<QueuedMutation>>([
    { entityType: 'unknown' },
    { entityId: '' },
    { entityId: '  ' },
    { payloadValid: false },
    { operation: 'unsupported' },
  ])('rejects an invalid envelope or operation: %j', (overrides) => {
    expect(() => buildMutationRequest(mutation(overrides))).toThrow(InvalidQueuedMutationError);
  });

  it.each(['record-result', 'delete-result'])('%s requires a safe workout index', (operation) => {
    for (const workoutIndex of [undefined, null, '0', -1, 0.5, NaN, Infinity, 2 ** 53]) {
      expect(() =>
        buildMutationRequest(
          mutation({ operation, payload: { workoutIndex, slotId: 'squat', result: 'success' } })
        )
      ).toThrow(InvalidQueuedMutationError);
    }
  });

  it.each(['record-result', 'delete-result'])(
    '%s requires a nonblank slot identifier',
    (operation) => {
      for (const slotId of [undefined, null, 7, '', '  ']) {
        expect(() =>
          buildMutationRequest(
            mutation({ operation, payload: { workoutIndex: 0, slotId, result: 'success' } })
          )
        ).toThrow(InvalidQueuedMutationError);
      }
    }
  );

  it.each([undefined, null, true, '', 'SUCCESS', 'skipped'])('rejects result %j', (result) => {
    expect(() =>
      buildMutationRequest(mutation({ payload: { workoutIndex: 0, slotId: 'squat', result } }))
    ).toThrow(InvalidQueuedMutationError);
  });

  it.each([undefined, null, 1, 'metadata', [], false])('rejects metadata %j', (metadata) => {
    expect(() =>
      buildMutationRequest(mutation({ operation: 'update-metadata', payload: { metadata } }))
    ).toThrow(InvalidQueuedMutationError);
  });

  it('classifies invalid Unicode identifiers as invalid intent instead of a network failure', () => {
    expect(() => buildMutationRequest(mutation({ entityId: '\uD800' }))).toThrow(
      InvalidQueuedMutationError
    );
    expect(() =>
      buildMutationRequest(
        mutation({ operation: 'delete-result', payload: { workoutIndex: 0, slotId: '\uDFFF' } })
      )
    ).toThrow(InvalidQueuedMutationError);
  });

  it('requires no authorization, database, fetch, or cancellation dependencies', () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    try {
      const request = buildMutationRequest(mutation());
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(request).not.toHaveProperty('headers');
      expect(request).not.toHaveProperty('signal');
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe('unrepresentable outbox paths', () => {
  it.each(['.', '..'])('retains invalid entity %s as a permanent outbox error', (entityId) => {
    expect(() => buildMutationRequest(mutation({ entityId }))).toThrow(InvalidQueuedMutationError);
  });

  it.each(['.', '..', '\ud800'])(
    'rejects deletion slot %j before it can alter the route',
    (slotId) => {
      expect(() =>
        buildMutationRequest(
          mutation({ operation: 'delete-result', payload: { workoutIndex: 0, slotId } })
        )
      ).toThrow(InvalidQueuedMutationError);
    }
  );

  it('keeps body-only identifiers under the domain payload contract', () => {
    const queued = mutation({ payload: { workoutIndex: 0, slotId: '.', result: 'success' } });
    expect(buildMutationRequest(queued).body).toBe(JSON.stringify(queued.payload));
  });
});
