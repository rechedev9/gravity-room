const mockAuthorized = jest.fn(async () => {
  throw new Error('transport reached');
});
const mockPublic = jest.fn(async () => {
  throw new Error('transport reached');
});
jest.mock('../auth/session', () => ({
  getAccessToken: () => 'token',
  buildApiUrl: (path) => `https://example.test/api${path}`,
  fetchWithAccessToken: (path) => mockAuthorized(path),
}));
jest.mock('./api-fetch', () => ({ fetchApiResponse: (url) => mockPublic(url) }));
const { fetchProgramDetail, fetchProgramDefinition } = require('../tracker/program-detail-service');

it.each([
  [fetchProgramDetail, mockAuthorized, '/programs/plan%2Fa%3Fx%23hash'],
  [fetchProgramDefinition, mockPublic, 'https://example.test/api/catalog/plan%2Fa%3Fx%23hash'],
])('encodes an identifier as one path segment', async (read, transport, expected) => {
  await expect(read('plan/a?x#hash')).rejects.toThrow('transport reached');
  expect(transport).toHaveBeenLastCalledWith(expected);
});

const { fetchCatalogDefinition } = require('../programs/program-service');

beforeEach(() => jest.clearAllMocks());

it('uses the same encoding for authorized catalog reads', async () => {
  await expect(fetchCatalogDefinition('plan/a?x#hash')).rejects.toThrow('transport reached');
  expect(mockAuthorized).toHaveBeenLastCalledWith('/catalog/plan%2Fa%3Fx%23hash');
});

it.each([fetchProgramDetail, fetchProgramDefinition, fetchCatalogDefinition])(
  'rejects malformed identifiers before transport',
  async (read) => {
    for (const id of ['', '  ', '.', '..', '\ud800', '\udfff']) {
      await expect(read(id)).rejects.toMatchObject({ name: 'InvalidApiPathIdentifierError' });
    }
    expect(mockAuthorized).not.toHaveBeenCalled();
    expect(mockPublic).not.toHaveBeenCalled();
  }
);
