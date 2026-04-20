import { getAccessToken } from '../auth/session';
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

function isProcessLike(
  value: unknown
): value is { readonly env?: Record<string, string | undefined> } {
  return isRecord(value);
}

function getApiBaseUrl(): string {
  const globalProcess = Reflect.get(globalThis, 'process');
  const processEnv = isProcessLike(globalProcess) ? globalProcess.env : undefined;
  return processEnv?.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
}

function buildProgramsRequestUrl(): URL {
  const requestUrl = new URL(getApiBaseUrl());
  const basePath = requestUrl.pathname.replace(/\/$/, '');
  requestUrl.pathname = `${basePath}/programs`;
  return requestUrl;
}

export async function fetchProgramSummaries(): Promise<ProgramSummary[]> {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('Program summaries require an access token');
  }

  const programs: ProgramSummary[] = [];
  let nextCursor: string | null | undefined;

  do {
    const requestUrl = buildProgramsRequestUrl();
    if (nextCursor) {
      requestUrl.searchParams.set('cursor', nextCursor);
    }

    const response = await fetch(requestUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

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
