import * as requests from '@gzclp/api-client/program-requests';
import { readApiError } from '@gzclp/api-client/response-error';
import { fetchApiResponse } from '../network/api-fetch';
import {
  GenericProgramDetailSchema,
  ProgramDefinitionSchema,
  type GenericProgramDetail,
  type ProgramDefinition,
} from '@gzclp/domain';

import { buildApiUrl, fetchWithAccessToken, getAccessToken } from '../auth/session';
import { ProgramDefinitionFetchError } from './program-definition-error';

export async function fetchProgramDetail(programInstanceId: string): Promise<GenericProgramDetail> {
  if (!getAccessToken()) {
    throw new Error('Program detail fetch requires an access token');
  }

  const { response } = await fetchWithAccessToken(requests.programDetail(programInstanceId).path);
  if (!response.ok) {
    throw await readApiError(
      response,
      `Program detail fetch failed with status ${response.status}`
    );
  }

  return GenericProgramDetailSchema.parse(await response.json());
}

export async function fetchProgramDefinition(programId: string): Promise<ProgramDefinition> {
  const response = await fetchApiResponse(buildApiUrl(requests.catalogDetail(programId).path));
  if (!response.ok) {
    throw new ProgramDefinitionFetchError(
      await readApiError(response, `Program definition fetch failed with status ${response.status}`)
    );
  }

  return ProgramDefinitionSchema.parse(await response.json());
}
