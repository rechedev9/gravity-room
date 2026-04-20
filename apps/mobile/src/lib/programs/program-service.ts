import { getAccessToken } from '../auth/session';
import type { ProgramSummary } from './program-repository';

interface RemoteProgramSummary {
  readonly id: string;
  readonly name?: string | null;
  readonly updatedAt?: string | null;
}

function getApiBaseUrl(): string {
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env;
  return processEnv?.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
}

export async function fetchProgramSummaries(): Promise<ProgramSummary[]> {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('Program summaries require an access token');
  }

  const response = await fetch(`${getApiBaseUrl()}/programs`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Program summary fetch failed with status ${response.status}`);
  }

  const payload = (await response.json()) as { items?: readonly RemoteProgramSummary[] };

  return (payload.items ?? []).map((program) => ({
    id: program.id,
    title: program.name ?? 'Untitled Program',
    updatedAt: program.updatedAt ?? new Date(0).toISOString(),
  }));
}
