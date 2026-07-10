import { describe, expect, it } from 'vitest';
import { readBoundedJson } from './bounded-json';

function invalidProviderResponse(): Error {
  return new Error('Invalid provider response');
}

describe('readBoundedJson', () => {
  it('parses a response within the byte limit', async () => {
    const response = new Response(JSON.stringify({ ok: true }));
    await expect(readBoundedJson(response, 100, invalidProviderResponse)).resolves.toEqual({
      ok: true,
    });
  });

  it('rejects an oversized declared Content-Length before reading', async () => {
    const response = new Response('{}', { headers: { 'content-length': '1000' } });
    await expect(readBoundedJson(response, 100, invalidProviderResponse)).rejects.toThrow(
      'Invalid provider response'
    );
  });

  it('rejects a streamed response that crosses the limit', async () => {
    const response = new Response(JSON.stringify({ data: 'x'.repeat(200) }));
    await expect(readBoundedJson(response, 50, invalidProviderResponse)).rejects.toThrow(
      'Invalid provider response'
    );
  });

  it('maps malformed JSON to the caller-provided safe error', async () => {
    const response = new Response('{not json');
    await expect(readBoundedJson(response, 100, invalidProviderResponse)).rejects.toThrow(
      'Invalid provider response'
    );
  });
});
