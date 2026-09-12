import { RequestTimeoutError } from '../network/api-fetch';
import { InvalidQueuedMutationError } from './mutation-request';

export class QueuedMutationHttpError extends Error {
  constructor(
    readonly status: number,
    readonly retryAt = 0
  ) {
    super(`Queued mutation sync failed with status ${status}`);
  }
}

type FailureKind = 'permanent' | 'authentication' | 'transient';
export type SyncFailureCode =
  | 'INVALID_OUTBOX'
  | 'REQUEST_TIMEOUT'
  | 'NETWORK_ERROR'
  | `HTTP_${number}`;

export interface SyncFailure {
  readonly code: SyncFailureCode;
  readonly kind: FailureKind;
}

function httpFailureKind(status: number): FailureKind {
  if (status === 401) return 'authentication';
  if (status >= 400 && status < 500 && ![408, 425, 429].includes(status)) return 'permanent';
  return 'transient';
}

/** One policy for retained diagnostics and the worker's next action. */
export function classifySyncFailure(error: unknown): SyncFailure {
  if (error instanceof InvalidQueuedMutationError)
    return { code: 'INVALID_OUTBOX', kind: 'permanent' };
  if (error instanceof QueuedMutationHttpError)
    return { code: `HTTP_${error.status}`, kind: httpFailureKind(error.status) };
  return {
    code: error instanceof RequestTimeoutError ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
    kind: 'transient',
  };
}

/** Authentication needs attention but does not permanently reject a plan's intent. */
export function syncDiagnosticNeedsAttention(code: string | null): boolean {
  if (code === 'INVALID_OUTBOX') return true;
  if (!code?.startsWith('HTTP_')) return false;
  return httpFailureKind(Number(code.slice(5))) !== 'transient';
}
