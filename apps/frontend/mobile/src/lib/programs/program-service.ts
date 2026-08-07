import {
  CatalogEntrySchema,
  GenericProgramDetailSchema,
  ProgramDefinitionSchema,
  type CatalogEntry,
  type GenericProgramDetail,
  type ProgramDefinition,
} from '@gzclp/domain';
import { isRecord } from '@gzclp/domain/type-guards';
import { mobileApiTransport } from '../api/transport';
import type { ProgramSummary } from './program-repository';

interface RemoteProgramSummary {
  readonly id: string;
  readonly name?: string | null;
  readonly updatedAt?: string | null;
}

interface RemoteProgramsPage {
  readonly data: readonly RemoteProgramSummary[];
  readonly nextCursor: string | null;
}

const DEFAULT_WEIGHT_FALLBACK = 20;
const DEFAULT_WEIGHT_MULTIPLIER = 8;

function isRemoteProgramSummary(value: unknown): value is RemoteProgramSummary {
  if (!isRecord(value)) {
    return false;
  }

  const name = value.name;
  const updatedAt = value.updatedAt;
  return (
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

export async function fetchProgramSummaries(): Promise<ProgramSummary[]> {
  const programs: ProgramSummary[] = [];
  let nextCursor: string | null | undefined;
  const visitedCursors = new Set<string>();

  do {
    const requestUrl = new URL('http://localhost');
    requestUrl.pathname = '/programs';
    if (nextCursor) {
      requestUrl.searchParams.set('cursor', nextCursor);
    }

    const payload = await mobileApiTransport.request(`${requestUrl.pathname}${requestUrl.search}`, {
      parse: readRemoteProgramsPage,
    });
    for (const program of payload.data) {
      programs.push({
        id: program.id,
        title: program.name ?? 'Untitled Program',
        updatedAt: program.updatedAt ?? new Date(0).toISOString(),
      });
    }

    nextCursor = payload.nextCursor;
    if (nextCursor) {
      if (visitedCursors.has(nextCursor)) {
        throw new Error('Program summary pagination repeated a cursor');
      }
      visitedCursors.add(nextCursor);
    }
  } while (nextCursor);

  return programs;
}

export async function fetchCatalogEntries(): Promise<CatalogEntry[]> {
  return mobileApiTransport.request('/catalog', {
    parse: (body) => CatalogEntrySchema.array().parse(body),
  });
}

export async function fetchCatalogDefinition(programId: string): Promise<ProgramDefinition> {
  return mobileApiTransport.request(`/catalog/${encodeURIComponent(programId)}`, {
    parse: (body) => ProgramDefinitionSchema.parse(body),
  });
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
  return mobileApiTransport.request('/programs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    parse: (body) => GenericProgramDetailSchema.parse(body),
  });
}
