import { encodeApiPathIdentifier, InvalidApiPathIdentifierError } from './api-path-identifier';

describe('API identifier path boundary', () => {
  it.each([
    ['instance-123', 'instance-123'],
    ['a/b', 'a%2Fb'],
    ['a\\b', 'a%5Cb'],
    ['a?x=1#fragment', 'a%3Fx%3D1%23fragment'],
    [' plan ', '%20plan%20'],
    ['%2e%2e', '%252e%252e'],
    ['sentadilla 🏋️', 'sentadilla%20%F0%9F%8F%8B%EF%B8%8F'],
    ['a\tb\nc', 'a%09b%0Ac'],
  ])('encodes %s as data', (input, expected) => {
    expect(encodeApiPathIdentifier(input)).toBe(expected);
    const url = new URL(
      `https://example.test/api/programs/${encodeApiPathIdentifier(input)}/results`
    );
    expect(url.pathname).toBe(`/api/programs/${expected}/results`);
    expect(url.search).toBe('');
    expect(url.hash).toBe('');
  });

  it.each(['', ' ', '\n', '.', '..', '\ud800', '\udfff'])(
    'rejects unrepresentable identifier %j',
    (input) => {
      expect(() => encodeApiPathIdentifier(input)).toThrow(InvalidApiPathIdentifierError);
    }
  );

  it('does not decode preencoded text or trim valid IDs', () => {
    expect(decodeURIComponent(encodeApiPathIdentifier(' %2F '))).toBe(' %2F ');
  });
});
