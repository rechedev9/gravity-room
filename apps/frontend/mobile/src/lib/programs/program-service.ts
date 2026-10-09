import { collectCursorPages } from '@gzclp/api-client/cursor-pages';
import { encodeApiPathIdentifier } from '@gzclp/api-client/path-identifier';
import { readApiError } from '@gzclp/api-client/response-error';
import {
  CatalogEntrySchema,
  GenericProgramDetailSchema,
  ProgramDefinitionSchema,
  type CatalogEntry,
  type GenericProgramDetail,
  type ProgramDefinition,
} from '@gzclp/domain';
import { isRecord } from '@gzclp/domain/type-guards';
import { fetchWithAccessToken, getAccessToken } from '../auth/session';
import type { ProgramSummary } from './program-repository';

interface RemoteProgramSummary {
  readonly programId?: string;
  readonly id: string;
  readonly name?: string | null;
  readonly updatedAt?: string | null;
}

interface RemoteProgramsPage {
  readonly data: readonly RemoteProgramSummary[];
  readonly nextCursor: string | null;
}

function isRemoteProgramSummary(value: unknown): value is RemoteProgramSummary {
  if (!isRecord(value)) {
    return false;
  }

  const name = value.name;
  const updatedAt = value.updatedAt;
  return (
    (value.programId === undefined || typeof value.programId === 'string') &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    (name === undefined || name === null || typeof name === 'string') &&
    (updatedAt === undefined || updatedAt === null || typeof updatedAt === 'string')
  );
}

function readRemoteProgramsPage(value: unknown): RemoteProgramsPage {
  if (!isRecord(value)) {
    throw new Error('Invalid program summary response');
  }

  const rawData = value.data;
  if (!Array.isArray(rawData) || !rawData.every(isRemoteProgramSummary)) {
    throw new Error('Invalid program summary response');
  }

  const rawNextCursor = value.nextCursor;
  if (rawNextCursor !== null && typeof rawNextCursor !== 'string') {
    throw new Error('Invalid program summary response');
  }

  return { data: rawData, nextCursor: rawNextCursor };
}

/** Upper bound on list pages: the server caps a user at 100 plans, 20 per page. */
const MAX_PROGRAM_LIST_PAGES = 50;

export async function fetchProgramSummaries(): Promise<ProgramSummary[]> {
  if (!getAccessToken()) {
    throw new Error('Program summaries require an access token');
  }

  return collectCursorPages({
    maxPages: MAX_PROGRAM_LIST_PAGES,
    fetchPage: async (cursor) => {
      const query = cursor === undefined ? '' : `?${new URLSearchParams({ cursor }).toString()}`;
      const { response } = await fetchWithAccessToken(`/programs${query}`);

      if (!response.ok) {
        throw await readApiError(
          response,
          `Program summary fetch failed with status ${response.status}`
        );
      }

      const payload = readRemoteProgramsPage(await response.json());
      return {
        data: payload.data.map(
          (program): ProgramSummary => ({
            id: program.id,
            ...(program.programId !== undefined ? { programId: program.programId } : {}),
            title: program.name ?? 'Untitled Program',
            updatedAt: program.updatedAt ?? new Date(0).toISOString(),
          })
        ),
        nextCursor: payload.nextCursor,
      };
    },
  });
}

export async function fetchCatalogEntries(): Promise<CatalogEntry[]> {
  const response = await fetchWithAccessToken('/catalog');
  if (!response.response.ok) {
    throw await readApiError(
      response.response,
      `Catalog fetch failed with status ${response.response.status}`
    );
  }

  const payload = await response.response.json();
  if (!Array.isArray(payload)) {
    throw new Error('Invalid catalog response');
  }

  return payload.map((entry) => CatalogEntrySchema.parse(entry));
}

export async function fetchCatalogDefinition(programId: string): Promise<ProgramDefinition> {
  const response = await fetchWithAccessToken(`/catalog/${encodeApiPathIdentifier(programId)}`);
  if (!response.response.ok) {
    throw await readApiError(
      response.response,
      `Catalog definition fetch failed with status ${response.response.status}`
    );
  }

  return ProgramDefinitionSchema.parse(await response.response.json());
}

export async function createProgramInstance(input: {
  readonly programId: string;
  readonly name: string;
  readonly config: Record<string, number | string>;
}): Promise<GenericProgramDetail> {
  if (!getAccessToken()) {
    throw new Error('Program creation requires an access token');
  }

  const { response } = await fetchWithAccessToken('/programs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw await readApiError(response, `Program creation failed with status ${response.status}`);
  }

  return GenericProgramDetailSchema.parse(await response.json());
}

/** Deletes a plan on the server; a missing plan counts as deleted. */
export async function deleteProgramInstance(programInstanceId: string): Promise<void> {
  const { response } = await fetchWithAccessToken(
    `/programs/${encodeApiPathIdentifier(programInstanceId)}`,
    { method: 'DELETE' }
  );
  if (response.ok || response.status === 404) return;
  throw await readApiError(response, `Program deletion failed with status ${response.status}`);
}

/** Existing plans started from the same catalog program. */
export function findPlansFromProgram(
  programs: readonly ProgramSummary[],
  programId: string
): readonly ProgramSummary[] {
  return programs.filter((program) => program.programId === programId);
}
