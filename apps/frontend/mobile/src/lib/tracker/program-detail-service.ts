import {
  GenericProgramDetailSchema,
  ProgramDefinitionSchema,
  type GenericProgramDetail,
  type ProgramDefinition,
} from '@gzclp/domain';

import { buildApiUrl, fetchWithAccessToken, getAccessToken } from '../auth/session';

export async function fetchProgramDetail(programInstanceId: string): Promise<GenericProgramDetail> {
  if (!getAccessToken()) {
    throw new Error('Program detail fetch requires an access token');
  }

  const { response } = await fetchWithAccessToken(`/programs/${programInstanceId}`);
  if (!response.ok) {
    throw new Error(`Program detail fetch failed with status ${response.status}`);
  }

  return GenericProgramDetailSchema.parse(await response.json());
}

export async function fetchProgramDefinition(programId: string): Promise<ProgramDefinition> {
  const response = await fetch(buildApiUrl(`/catalog/${programId}`));
  if (!response.ok) {
    throw new Error(`Program definition fetch failed with status ${response.status}`);
  }

  return ProgramDefinitionSchema.parse(await response.json());
}
