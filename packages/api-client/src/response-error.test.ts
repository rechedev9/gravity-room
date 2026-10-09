import { describe, expect, it } from 'vitest';
import { ApiError } from './api-error';
import { readApiError } from './response-error';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('readApiError', () => {
  it('uses the server message and code and keeps the status', async () => {
    const error = await readApiError(
      jsonResponse({ error: 'Plan not found', code: 'NOT_FOUND' }, 404),
      'fallback'
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.message).toBe('Plan not found [NOT_FOUND]');
    expect(error.status).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
  });

  it('falls back to the caller message when the body has no error text', async () => {
    const error = await readApiError(jsonResponse({}, 500), 'Program deletion failed');
    expect(error.message).toBe('Program deletion failed');
    expect(error.status).toBe(500);
    expect(error.code).toBeUndefined();
  });

  it('falls back when the body is not JSON', async () => {
    const error = await readApiError(new Response('<html>', { status: 502 }), 'Bad gateway');
    expect(error.message).toBe('Bad gateway');
    expect(error.status).toBe(502);
  });
});
