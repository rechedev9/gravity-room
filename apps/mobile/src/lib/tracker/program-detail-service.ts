import {
  GenericProgramDetailSchema,
  ProgramDefinitionSchema,
  type GenericProgramDetail,
  type ProgramDefinition,
} from '@gzclp/domain';

import { getAccessToken } from '../auth/session';

function getApiBaseUrl(): string {
  const processLike = Reflect.get(globalThis, 'process');
  if (typeof processLike !== 'object' || processLike === null) {
    return 'http://localhost:3001';
  }

  const envLike = Reflect.get(processLike, 'env');
  if (typeof envLike !== 'object' || envLike === null) {
    return 'http://localhost:3001';
  }

  const configuredBaseUrl = Reflect.get(envLike, 'EXPO_PUBLIC_API_URL');
  return typeof configuredBaseUrl === 'string' ? configuredBaseUrl : 'http://localhost:3001';
}

function getAuthorizedHeaders(): { readonly Authorization: string } {
  const accessToken = getAccessToken();
  if (!accessToken) {
    throw new Error('Program detail fetch requires an access token');
  }

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function fetchProgramDetail(programInstanceId: string): Promise<GenericProgramDetail> {
  const response = await fetch(`${getApiBaseUrl()}/programs/${programInstanceId}`, {
    headers: getAuthorizedHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Program detail fetch failed with status ${response.status}`);
  }

  return GenericProgramDetailSchema.parse(await response.json());
}

export async function fetchProgramDefinition(programId: string): Promise<ProgramDefinition> {
  const response = await fetch(`${getApiBaseUrl()}/catalog/${programId}`);
  if (!response.ok) {
    throw new Error(`Program definition fetch failed with status ${response.status}`);
  }

  return ProgramDefinitionSchema.parse(await response.json());
}
