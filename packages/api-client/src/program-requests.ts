import type { ResultValue, SetLogEntry } from '@gzclp/domain/types';
import { encodeApiPathIdentifier } from './path-identifier';

export interface ApiRequest {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Relative to the API prefix, as web `apiFetch` and mobile `buildApiUrl` expect. */
  readonly path: string;
  readonly body?: unknown;
}

/** The `fetch` init fields a request carries; the transport adds headers and auth. */
export function toRequestInit(request: ApiRequest): { method: string; body?: string } {
  return request.body === undefined
    ? { method: request.method }
    : { method: request.method, body: JSON.stringify(request.body) };
}

function programPath(instanceId: string): string {
  return `/programs/${encodeApiPathIdentifier(instanceId)}`;
}

export function listPrograms(cursor?: string): ApiRequest {
  return {
    method: 'GET',
    path: cursor === undefined ? '/programs' : `/programs?cursor=${encodeURIComponent(cursor)}`,
  };
}

export function programDetail(instanceId: string): ApiRequest {
  return { method: 'GET', path: programPath(instanceId) };
}

export function createProgram(options: {
  readonly programId: string;
  readonly name: string;
  readonly config: Readonly<Record<string, number | string>>;
}): ApiRequest {
  const { programId, name, config } = options;
  return { method: 'POST', path: '/programs', body: { programId, name, config: { ...config } } };
}

export function updateProgramConfig(
  instanceId: string,
  config: Readonly<Record<string, number | string>>
): ApiRequest {
  return { method: 'PATCH', path: programPath(instanceId), body: { config: { ...config } } };
}

export function completeProgram(instanceId: string): ApiRequest {
  return { method: 'PATCH', path: programPath(instanceId), body: { status: 'completed' } };
}

export function deleteProgram(instanceId: string): ApiRequest {
  return { method: 'DELETE', path: programPath(instanceId) };
}

export function exportProgram(instanceId: string): ApiRequest {
  return { method: 'GET', path: `${programPath(instanceId)}/export` };
}

export function importProgram(payload: unknown): ApiRequest {
  return { method: 'POST', path: '/programs/import', body: payload };
}

export function updateMetadata(
  instanceId: string,
  metadata: Readonly<Record<string, unknown>>
): ApiRequest {
  return { method: 'PATCH', path: `${programPath(instanceId)}/metadata`, body: { metadata } };
}

export function recordResult(options: {
  readonly instanceId: string;
  readonly workoutIndex: number;
  readonly slotId: string;
  readonly result: ResultValue;
  readonly amrapReps?: number;
  readonly rpe?: number;
  readonly setLogs?: readonly SetLogEntry[];
}): ApiRequest {
  const { instanceId, workoutIndex, slotId, result, amrapReps, rpe, setLogs } = options;
  return {
    method: 'POST',
    path: `${programPath(instanceId)}/results`,
    body: {
      workoutIndex,
      slotId,
      result,
      ...(amrapReps !== undefined ? { amrapReps } : {}),
      ...(rpe !== undefined ? { rpe } : {}),
      ...(setLogs !== undefined ? { setLogs } : {}),
    },
  };
}

export function deleteResult(options: {
  readonly instanceId: string;
  readonly workoutIndex: number;
  readonly slotId: string;
}): ApiRequest {
  const { instanceId, workoutIndex, slotId } = options;
  return {
    method: 'DELETE',
    path: `${programPath(instanceId)}/results/${workoutIndex}/${encodeApiPathIdentifier(slotId)}`,
  };
}

export function undoLastResult(instanceId: string): ApiRequest {
  return { method: 'POST', path: `${programPath(instanceId)}/undo` };
}

export function catalogList(): ApiRequest {
  return { method: 'GET', path: '/catalog' };
}

export function catalogDetail(programId: string): ApiRequest {
  return { method: 'GET', path: `/catalog/${encodeApiPathIdentifier(programId)}` };
}
