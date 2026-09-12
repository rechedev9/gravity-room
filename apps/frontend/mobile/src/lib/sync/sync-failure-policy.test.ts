import { RequestTimeoutError } from '../network/api-fetch';
import { InvalidQueuedMutationError } from './mutation-request';
import {
  classifySyncFailure,
  QueuedMutationHttpError,
  syncDiagnosticNeedsAttention,
} from './sync-failure-policy';

it.each([400, 403, 404, 409, 410, 413, 422, 499])(
  'retains HTTP %s as a rejected intent needing attention',
  (status) => {
    const failure = classifySyncFailure(new QueuedMutationHttpError(status));
    expect(failure).toEqual({ code: `HTTP_${status}`, kind: 'permanent' });
    expect(syncDiagnosticNeedsAttention(failure.code)).toBe(true);
  }
);

it.each([408, 425, 429, 500, 502, 503, 504, 599])(
  'keeps HTTP %s retryable without claiming an edit needs repair',
  (status) => {
    const failure = classifySyncFailure(new QueuedMutationHttpError(status));
    expect(failure).toEqual({ code: `HTTP_${status}`, kind: 'transient' });
    expect(syncDiagnosticNeedsAttention(failure.code)).toBe(false);
  }
);

it('separates authentication recovery from permanent plan rejection', () => {
  const failure = classifySyncFailure(new QueuedMutationHttpError(401));
  expect(failure).toEqual({ code: 'HTTP_401', kind: 'authentication' });
  expect(syncDiagnosticNeedsAttention(failure.code)).toBe(true);
});

it('retains invalid persisted intent for repair', () => {
  const failure = classifySyncFailure(new InvalidQueuedMutationError('invalid payload'));
  expect(failure).toEqual({ code: 'INVALID_OUTBOX', kind: 'permanent' });
  expect(syncDiagnosticNeedsAttention(failure.code)).toBe(true);
});

it('preserves timeout diagnostics while treating transport failures as retryable', () => {
  expect(classifySyncFailure(new RequestTimeoutError())).toEqual({
    code: 'REQUEST_TIMEOUT',
    kind: 'transient',
  });
  expect(syncDiagnosticNeedsAttention('REQUEST_TIMEOUT')).toBe(false);
  expect(classifySyncFailure(new TypeError('fetch failed'))).toEqual({
    code: 'NETWORK_ERROR',
    kind: 'transient',
  });
});

it.each([null, undefined, 'offline', { message: 'offline' }, new Error('HTTP_403')])(
  'does not infer a server rejection from an untyped error %j',
  (error) => {
    expect(classifySyncFailure(error)).toEqual({ code: 'NETWORK_ERROR', kind: 'transient' });
  }
);

it.each([null, '', 'NETWORK_ERROR', 'UNKNOWN', 'HTTP_', 'HTTP_nope', 'HTTP_200', 'HTTP_302'])(
  'does not mark pending or unrecognized diagnostic %j as a rejected edit',
  (code) => {
    expect(syncDiagnosticNeedsAttention(code)).toBe(false);
  }
);

it('preserves the server retry deadline separately from failure classification', () => {
  const error = new QueuedMutationHttpError(429, 123456);
  expect(error.retryAt).toBe(123456);
  expect(error.message).toBe('Queued mutation sync failed with status 429');
  expect(classifySyncFailure(error)).toEqual({ code: 'HTTP_429', kind: 'transient' });
  expect(error.retryAt).toBe(123456);
});

it('keeps failure classification deterministic and independent of wall time', () => {
  const clock = jest.spyOn(Date, 'now').mockImplementation(() => {
    throw new Error('no clock needed');
  });
  try {
    expect(classifySyncFailure(new QueuedMutationHttpError(503)).kind).toBe('transient');
    expect(syncDiagnosticNeedsAttention('HTTP_401')).toBe(true);
  } finally {
    clock.mockRestore();
  }
});
