import { ApiError } from '@gzclp/api-client/api-error';

/** A failed catalog definition fetch; separates a broken template from a missing plan. */
export class ProgramDefinitionFetchError extends ApiError {
  constructor(cause: ApiError) {
    super(cause.message, cause.status, cause.code);
    this.name = 'ProgramDefinitionFetchError';
  }
}
