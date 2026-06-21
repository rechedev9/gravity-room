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
  readonly id: string;
  readonly name?: string | null;
  readonly updatedAt?: string | null;
}

interface RemoteProgramsPage {
  readonly data?: readonly RemoteProgramSummary[];
  readonly nextCursor?: string | null;
}

const DEFAULT_WEIGHT_FALLBACK = 20;
const DEFAULT_WEIGHT_MULTIPLIER = 8;

function isRemoteProgramSummary(value: unknown): value is RemoteProgramSummary {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.id === 'string';
}

function readRemoteProgramsPage(value: unknown): RemoteProgramsPage {
  if (!isRecord(value)) {
    return {};
  }

  const rawData = value.data;
  const data = Array.isArray(rawData) ? rawData.filter(isRemoteProgramSummary) : undefined;
  const nextCursor =
    typeof value.nextCursor === 'string' || value.nextCursor === null
      ? value.nextCursor
      : undefined;

  return {
    ...(data ? { data } : {}),
    ...(nextCursor !== undefined ? { nextCursor } : {}),
  };
}

export async function fetchProgramSummaries(): Promise<ProgramSummary[]> {
  if (!getAccessToken()) {
    throw new Error('Program summaries require an access token');
  }

  const programs: ProgramSummary[] = [];
  let nextCursor: string | null | undefined;

  do {
    const requestUrl = new URL('http://localhost');
    requestUrl.pathname = '/programs';
    if (nextCursor) {
      requestUrl.searchParams.set('cursor', nextCursor);
    }

    const { response } = await fetchWithAccessToken(`${requestUrl.pathname}${requestUrl.search}`);

    if (!response.ok) {
      throw new Error(`Program summary fetch failed with status ${response.status}`);
    }

    const payload = readRemoteProgramsPage(await response.json());
    for (const program of payload.data ?? []) {
      programs.push({
        id: program.id,
        title: program.name ?? 'Untitled Program',
        updatedAt: program.updatedAt ?? new Date(0).toISOString(),
      });
    }

    nextCursor = payload.nextCursor;
  } while (nextCursor);

  return programs;
}

export async function fetchCatalogEntries(): Promise<CatalogEntry[]> {
  const response = await fetchWithAccessToken('/catalog');
  if (!response.response.ok) {
    throw new Error(`Catalog fetch failed with status ${response.response.status}`);
  }

  const payload = await response.response.json();
  if (!Array.isArray(payload)) {
    throw new Error('Invalid catalog response');
  }

  return payload.map((entry) => CatalogEntrySchema.parse(entry));
}

export async function fetchCatalogDefinition(programId: string): Promise<ProgramDefinition> {
  const response = await fetchWithAccessToken(`/catalog/${encodeURIComponent(programId)}`);
  if (!response.response.ok) {
    throw new Error(`Catalog definition fetch failed with status ${response.response.status}`);
  }

  return ProgramDefinitionSchema.parse(await response.response.json());
}

export function buildDefaultProgramConfig(
  definition: ProgramDefinition
): Record<string, number | string> {
  const config: Record<string, number | string> = {};

  for (const field of definition.configFields) {
    if (field.type === 'weight') {
      config[field.key] =
        field.min > 0
          ? field.min
          : field.step * DEFAULT_WEIGHT_MULTIPLIER || DEFAULT_WEIGHT_FALLBACK;
      continue;
    }

    const firstOption = field.options[0];
    if (!firstOption) {
      throw new Error(`Missing options for ${field.key}`);
    }
    config[field.key] = firstOption.value;
  }

  return config;
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
    throw new Error(`Program creation failed with status ${response.status}`);
  }

  return GenericProgramDetailSchema.parse(await response.json());
}
