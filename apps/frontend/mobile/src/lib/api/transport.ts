import { createApiTransport, type ApiFetch, type ApiTransport } from '@gzclp/api-client/transport';

import { buildApiUrl, getAccessToken, refreshAccessTokenForRequest } from '../auth/session';

const fetchRequest: ApiFetch = (input, init) => globalThis.fetch(input, init);

/**
 * Shared transport for mobile API services. The fetch indirection keeps tests
 * and React Native's runtime fetch implementation observable after import.
 */
export const mobileApiTransport: ApiTransport = createApiTransport({
  baseUrl: buildApiUrl('/'),
  fetch: fetchRequest,
  auth: {
    getAccessToken,
    refreshAccessToken: refreshAccessTokenForRequest,
  },
});
