import {
  GenericProgramDetailSchema,
  ProgramDefinitionSchema,
  type GenericProgramDetail,
  type ProgramDefinition,
} from '@gzclp/domain';

import {
  buildApiUrl,
  fetchWithAccessToken,
  fetchWithAuthorizedSession,
  getAccessToken,
  type AuthorizedSession,
} from '../auth/session';

export async function fetchProgramDetail(
  programInstanceId: string,
  session?: AuthorizedSession
): Promise<GenericProgramDetail> {
  if (!session && !getAccessToken()) {
    throw new Error('Program detail fetch requires an access token');
  }

  const path = `/programs/${programInstanceId}`;
  const response = session
    ? await fetchWithAuthorizedSession(session, path)
    : (await fetchWithAccessToken(path)).response;
  if (!response.ok) {
    throw new Error(`Program detail fetch failed with status ${response.status}`);
  }

  return GenericProgramDetailSchema.parse(await response.json());
}

export async function fetchProgramDefinition(
  programId: string,
  session?: AuthorizedSession
): Promise<ProgramDefinition> {
  const path = `/catalog/${programId}`;
  const response = session
    ? await fetchWithAuthorizedSession(session, path)
    : await fetch(buildApiUrl(path));
  if (!response.ok) {
    throw new Error(`Program definition fetch failed with status ${response.status}`);
  }

  return ProgramDefinitionSchema.parse(await response.json());
}
