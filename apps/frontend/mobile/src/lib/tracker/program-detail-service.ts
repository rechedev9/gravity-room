import {
  GenericProgramDetailSchema,
  ProgramDefinitionSchema,
  type GenericProgramDetail,
  type ProgramDefinition,
} from '@gzclp/domain';

import { mobileApiTransport } from '../api/transport';

export async function fetchProgramDetail(programInstanceId: string): Promise<GenericProgramDetail> {
  return mobileApiTransport.request(`/programs/${encodeURIComponent(programInstanceId)}`, {
    parse: (body) => GenericProgramDetailSchema.parse(body),
  });
}

export async function fetchProgramDefinition(programId: string): Promise<ProgramDefinition> {
  return mobileApiTransport.request(`/catalog/${encodeURIComponent(programId)}`, {
    authenticated: false,
    parse: (body) => ProgramDefinitionSchema.parse(body),
  });
}
