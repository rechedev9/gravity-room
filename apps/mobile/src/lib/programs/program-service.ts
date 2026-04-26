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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

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
