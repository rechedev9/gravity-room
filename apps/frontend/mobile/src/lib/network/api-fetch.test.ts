import { API_REQUEST_TIMEOUT_MS, fetchApiResponse, RequestTimeoutError } from './api-fetch';

describe('API request lifetime', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('aborts and releases a stalled connection, even when the transport ignores cancellation', async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      signal = init?.signal;
      return new Promise<Response>(() => undefined);
    });
    const pending = fetchApiResponse('https://example.test/api/programs');
    const rejected = expect(pending).rejects.toBeInstanceOf(RequestTimeoutError);
    await jest.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);
    await rejected;
    expect(signal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps the deadline while the response body stalls after headers arrive', async () => {
    jest.useFakeTimers();
    const response = new Response('{}');
    jest.spyOn(response, 'text').mockImplementation(() => new Promise<string>(() => undefined));
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(response);
    const rejected = expect(
      fetchApiResponse('https://example.test/api/programs')
    ).rejects.toBeInstanceOf(RequestTimeoutError);
    await jest.advanceTimersByTimeAsync(API_REQUEST_TIMEOUT_MS);
    await rejected;
    expect(jest.getTimerCount()).toBe(0);
  });

  it('preserves the HTTP failure and retry headers and releases the parent listener', async () => {
    jest.useFakeTimers();
    const controller = new AbortController();
    const removed = jest.spyOn(controller.signal, 'removeEventListener');
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"code":"RATE_LIMITED"}', {
        status: 429,
        headers: { 'Retry-After': '30' },
      })
    );
    const response = await fetchApiResponse('https://example.test/api/programs', {
      signal: controller.signal,
    });
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(await response.json()).toEqual({ code: 'RATE_LIMITED' });
    expect(removed).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(jest.getTimerCount()).toBe(0);
  });

  it('cancels on account transition and rejects already-aborted requests before fetching', async () => {
    jest.useFakeTimers();
    const controller = new AbortController();
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => new Promise<Response>(() => undefined));
    const pending = fetchApiResponse('https://example.test/api/programs', {
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    await expect(
      fetchApiResponse('https://example.test/api/programs', { signal: controller.signal })
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });
});
