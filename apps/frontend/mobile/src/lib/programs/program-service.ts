import {
  CatalogEntrySchema,
  GenericProgramDetailSchema,
  MAX_PROGRAM_WEIGHT,
  ProgramDefinitionSchema,
  ProgramInstanceSchema,
  type CatalogEntry,
  type GenericProgramDetail,
  type ProgramDefinition,
} from '@gzclp/domain';
import { validateProgramConfig, type ProgramConfig } from '@gzclp/domain/program-config';
import { isRecord } from '@gzclp/domain/type-guards';

import {
  captureAuthorizedSession,
  fetchWithAccessToken,
  fetchWithAuthorizedSession,
  getAccessToken,
  type AuthorizedSession,
} from '../auth/session';
import type { ProgramStatus, ProgramSummary } from './program-repository';

interface RemoteProgramsPage {
  readonly data: readonly ProgramSummary[];
  readonly nextCursor: string | null;
}

export type ProgramManagementMutation =
  | { readonly type: 'rename'; readonly name: string }
  | { readonly type: 'set_status'; readonly status: ProgramStatus }
  | { readonly type: 'set_config'; readonly config: ProgramConfig };

export type DeleteRemoteResult = 'deleted' | 'already_absent';

export class RemoteMutationOutcomeUnknownError extends Error {
  readonly operation: 'create' | 'manage' | 'delete';
  readonly entityId: string | null;

  constructor(operation: 'create' | 'manage' | 'delete', entityId: string | null, cause: unknown) {
    super(`The ${operation} request outcome is unknown`, { cause });
    this.name = 'RemoteMutationOutcomeUnknownError';
    this.operation = operation;
    this.entityId = entityId;
  }
}

export class RemoteMutationAcknowledgedError extends Error {
  readonly operation: 'create' | 'manage';
  readonly entityId: string | null;

  constructor(operation: 'create' | 'manage', entityId: string | null, cause: unknown) {
    super(`The ${operation} request was acknowledged but its response was invalid`, { cause });
    this.name = 'RemoteMutationAcknowledgedError';
    this.operation = operation;
    this.entityId = entityId;
  }
}

export class RemoteMutationRejectedError extends Error {
  readonly operation: 'create' | 'manage' | 'delete';
  readonly entityId: string | null;
  readonly status: number;

  constructor(operation: 'create' | 'manage' | 'delete', entityId: string | null, status: number) {
    super(`The ${operation} request was rejected with status ${status}`);
    this.name = 'RemoteMutationRejectedError';
    this.operation = operation;
    this.entityId = entityId;
    this.status = status;
  }
}

function rethrowUnsentSessionPreflight(error: unknown): void {
  if (
    error instanceof Error &&
    error.name === 'ObsoleteAuthorizedSessionError' &&
    'requestDispatched' in error &&
    error.requestDispatched === false
  ) {
    throw error;
  }
}

const DEFAULT_WEIGHT_FALLBACK = 20;
const DEFAULT_WEIGHT_STEPS = 8;

function readRemoteEntityId(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null || !('id' in payload)) {
    return null;
  }
  return typeof payload.id === 'string' && payload.id.length > 0 ? payload.id : null;
}

async function isAuthoritativeProgramAbsence(response: Response): Promise<boolean> {
  try {
    const payload: unknown = await response.json();
    return isRecord(payload) && payload.code === 'INSTANCE_NOT_FOUND';
  } catch {
    return false;
  }
}

function parseProgramStatus(value: unknown): ProgramStatus {
  return ProgramInstanceSchema.shape.status.parse(value);
}

function parseRemoteProgramSummary(value: unknown): ProgramSummary {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.programId !== 'string' ||
    typeof value.name !== 'string' ||
    typeof value.createdAt !== 'string' ||
    typeof value.updatedAt !== 'string'
  ) {
    throw new Error('Invalid program summary response');
  }

  return {
    id: value.id,
    programId: value.programId,
    title: value.name,
    status: parseProgramStatus(value.status),
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function readRemoteProgramsPage(value: unknown): RemoteProgramsPage {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    throw new Error('Invalid programs page response');
  }
  if (value.nextCursor !== null && typeof value.nextCursor !== 'string') {
    throw new Error('Invalid programs cursor response');
  }

  return {
    data: value.data.map(parseRemoteProgramSummary),
    nextCursor: value.nextCursor,
  };
}

function parseCatalogEntry(value: unknown): CatalogEntry {
  const entry = CatalogEntrySchema.parse(value);
  if (
    entry.id.length === 0 ||
    entry.name.length === 0 ||
    entry.source !== 'preset' ||
    entry.totalWorkouts <= 0 ||
    entry.workoutsPerWeek <= 0 ||
    entry.cycleLength <= 0
  ) {
    throw new Error('Invalid catalog entry response');
  }

  return entry;
}

function requireAccessToken(message: string): void {
  if (!getAccessToken()) {
    throw new Error(message);
  }
}

function captureOwnerSession(
  ownerUserId: string | undefined,
  tokenRequiredMessage: string
): AuthorizedSession | undefined {
  if (ownerUserId !== undefined) {
    return captureAuthorizedSession(ownerUserId);
  }
  requireAccessToken(tokenRequiredMessage);
  return undefined;
}

async function fetchProgramResource(
  path: string,
  init: RequestInit | undefined,
  session: AuthorizedSession | undefined
): Promise<Response> {
  if (session) {
    return fetchWithAuthorizedSession(session, path, init);
  }
  const { response } = await fetchWithAccessToken(path, init);
  return response;
}

export async function fetchProgramSummaries(
  session?: AuthorizedSession
): Promise<ProgramSummary[]> {
  if (!session) {
    requireAccessToken('Program summaries require an access token');
  }

  const programs: ProgramSummary[] = [];
  let nextCursor: string | null = null;

  do {
    const requestUrl = new URL('http://localhost');
    requestUrl.pathname = '/programs';
    if (nextCursor) {
      requestUrl.searchParams.set('cursor', nextCursor);
    }

    const response = await fetchProgramResource(
      `${requestUrl.pathname}${requestUrl.search}`,
      undefined,
      session
    );
    if (!response.ok) {
      throw new Error(`Program summary fetch failed with status ${response.status}`);
    }

    const page = readRemoteProgramsPage(await response.json());
    programs.push(...page.data);
    nextCursor = page.nextCursor;
  } while (nextCursor !== null);

  return programs;
}

export async function fetchProgramInstance(
  programInstanceId: string,
  session?: AuthorizedSession
): Promise<GenericProgramDetail> {
  if (!session) {
    requireAccessToken('Program detail requires an access token');
  }
  const response = await fetchProgramResource(
    `/programs/${encodeURIComponent(programInstanceId)}`,
    undefined,
    session
  );
  if (!response.ok) {
    throw new Error(`Program detail fetch failed with status ${response.status}`);
  }
  return GenericProgramDetailSchema.parse(await response.json());
}

export async function fetchProgramInstanceIfExists(
  programInstanceId: string,
  session: AuthorizedSession
): Promise<GenericProgramDetail | null> {
  const response = await fetchProgramResource(
    `/programs/${encodeURIComponent(programInstanceId)}`,
    undefined,
    session
  );
  if (response.status === 404) {
    if (await isAuthoritativeProgramAbsence(response)) {
      return null;
    }
    throw new Error('Program detail verification failed with status 404');
  }
  if (!response.ok) {
    throw new Error(`Program detail verification failed with status ${response.status}`);
  }
  return GenericProgramDetailSchema.parse(await response.json());
}

export async function fetchCatalogEntries(session?: AuthorizedSession): Promise<CatalogEntry[]> {
  const response = await fetchProgramResource('/catalog', undefined, session);
  if (!response.ok) {
    throw new Error(`Catalog fetch failed with status ${response.status}`);
  }

  const payload: unknown = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('Invalid catalog response');
  }

  return payload.map(parseCatalogEntry);
}

export async function fetchCatalogDefinition(
  programId: string,
  session?: AuthorizedSession
): Promise<ProgramDefinition> {
  const response = await fetchProgramResource(
    `/catalog/${encodeURIComponent(programId)}`,
    undefined,
    session
  );
  if (!response.ok) {
    throw new Error(`Catalog definition fetch failed with status ${response.status}`);
  }

  const definition = ProgramDefinitionSchema.parse(await response.json());
  if (definition.source !== 'preset') {
    throw new Error('Catalog returned a non-preset definition');
  }
  return definition;
}

export function buildDefaultProgramConfig(definitionValue: unknown): ProgramConfig {
  const definition = ProgramDefinitionSchema.parse(definitionValue);
  const config: Record<string, number | string> = {};

  for (const field of definition.configFields) {
    if (field.type === 'weight') {
      const target = Math.max(
        field.min,
        DEFAULT_WEIGHT_FALLBACK,
        field.step * DEFAULT_WEIGHT_STEPS
      );
      const maximumSteps = Math.max(0, Math.floor((MAX_PROGRAM_WEIGHT - field.min) / field.step));
      let stepsFromMinimum = Math.min(
        maximumSteps,
        Math.max(0, Math.ceil((target - field.min) / field.step))
      );
      let value = field.min + stepsFromMinimum * field.step;
      while (value > MAX_PROGRAM_WEIGHT && stepsFromMinimum > 0) {
        stepsFromMinimum -= 1;
        value = field.min + stepsFromMinimum * field.step;
      }
      config[field.key] = value;
      continue;
    }

    const firstOption = field.options[0];
    if (!firstOption) {
      throw new Error(`Missing options for ${field.key}`);
    }
    config[field.key] = firstOption.value;
  }

  const result = validateProgramConfig(definition, config);
  if (!result.success) {
    throw new Error('Unable to build a valid default program setup');
  }

  return result.config;
}

export async function createProgramInstance(input: {
  readonly ownerUserId?: string;
  readonly session?: AuthorizedSession;
  readonly definition: ProgramDefinition;
  readonly name: string;
  readonly config: unknown;
  readonly idempotencyKey?: string;
}): Promise<GenericProgramDetail> {
  const session =
    input.session ??
    captureOwnerSession(input.ownerUserId, 'Program creation requires an access token');
  const definition = ProgramDefinitionSchema.parse(input.definition);
  if (definition.source !== 'preset') {
    throw new Error('Program creation requires a preset definition');
  }
  const validation = validateProgramConfig(definition, input.config);
  if (!validation.success) {
    throw new Error('Program creation requires valid setup');
  }
  let response: Response;
  try {
    response = await fetchProgramResource(
      '/programs',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(input.idempotencyKey === undefined
            ? {}
            : { 'Idempotency-Key': input.idempotencyKey }),
        },
        body: JSON.stringify({
          programId: definition.id,
          name: input.name,
          config: validation.config,
        }),
      },
      session
    );
  } catch (error) {
    rethrowUnsentSessionPreflight(error);
    throw new RemoteMutationOutcomeUnknownError('create', null, error);
  }

  if (!response.ok) {
    if (response.status >= 500) {
      throw new RemoteMutationOutcomeUnknownError(
        'create',
        null,
        new Error(`Program creation failed with status ${response.status}`)
      );
    }
    throw new RemoteMutationRejectedError('create', null, response.status);
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
    return GenericProgramDetailSchema.parse(payload);
  } catch (error) {
    throw new RemoteMutationAcknowledgedError('create', readRemoteEntityId(payload), error);
  }
}

export async function updateProgramInstance(
  programInstanceId: string,
  mutation: ProgramManagementMutation,
  session?: AuthorizedSession
): Promise<GenericProgramDetail> {
  if (!session) requireAccessToken('Program management requires an access token');
  let body:
    | { readonly name: string }
    | { readonly status: ProgramStatus }
    | { readonly config: ProgramConfig };
  if (mutation.type === 'rename') {
    const name = mutation.name.trim();
    if (name.length === 0) {
      throw new Error('Program name cannot be empty');
    }
    body = { name };
  } else if (mutation.type === 'set_status') {
    body = { status: mutation.status };
  } else {
    body = { config: mutation.config };
  }
  let response: Response;
  try {
    response = await fetchProgramResource(
      `/programs/${encodeURIComponent(programInstanceId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
      session
    );
  } catch (error) {
    rethrowUnsentSessionPreflight(error);
    throw new RemoteMutationOutcomeUnknownError('manage', programInstanceId, error);
  }
  if (!response.ok) {
    if (response.status >= 500) {
      throw new RemoteMutationOutcomeUnknownError(
        'manage',
        programInstanceId,
        new Error(`Program update failed with status ${response.status}`)
      );
    }
    throw new RemoteMutationRejectedError('manage', programInstanceId, response.status);
  }

  try {
    return GenericProgramDetailSchema.parse(await response.json());
  } catch (error) {
    throw new RemoteMutationAcknowledgedError('manage', programInstanceId, error);
  }
}

export async function deleteProgramInstance(
  programInstanceId: string,
  session?: AuthorizedSession
): Promise<DeleteRemoteResult> {
  if (!session) requireAccessToken('Program deletion requires an access token');
  let response: Response;
  try {
    response = await fetchProgramResource(
      `/programs/${encodeURIComponent(programInstanceId)}`,
      { method: 'DELETE' },
      session
    );
  } catch (error) {
    rethrowUnsentSessionPreflight(error);
    throw new RemoteMutationOutcomeUnknownError('delete', programInstanceId, error);
  }
  if (response.status === 404) {
    if (await isAuthoritativeProgramAbsence(response)) {
      return 'already_absent';
    }
    throw new RemoteMutationRejectedError('delete', programInstanceId, response.status);
  }
  if (!response.ok) {
    if (response.status >= 500) {
      throw new RemoteMutationOutcomeUnknownError(
        'delete',
        programInstanceId,
        new Error(`Program deletion failed with status ${response.status}`)
      );
    }
    throw new RemoteMutationRejectedError('delete', programInstanceId, response.status);
  }
  return 'deleted';
}
