/** API endpoints return finite JSON/text bodies; streaming endpoints need a separate transport. */
export const API_REQUEST_TIMEOUT_MS = 20_000;

export class RequestTimeoutError extends Error {
  constructor() {
    super('API request timed out');
    this.name = 'RequestTimeoutError';
  }
}

function abortedRequest(): Error {
  const error = new Error('API request aborted');
  error.name = 'AbortError';
  return error;
}

/** Owns the deadline, cancellation listener and body read until the entire response arrives. */
export async function fetchApiResponse(url: string, init?: RequestInit): Promise<Response> {
  const parentSignal = init?.signal;
  if (parentSignal?.aborted) throw abortedRequest();
  const controller = new AbortController();
  let cancel = (_error: Error): void => undefined;
  const interrupted = new Promise<never>((_resolve, reject) => {
    cancel = reject;
  });
  const abort = (): void => {
    cancel(abortedRequest());
    controller.abort();
  };
  parentSignal?.addEventListener('abort', abort);
  const timer = setTimeout(() => {
    cancel(new RequestTimeoutError());
    controller.abort();
  }, API_REQUEST_TIMEOUT_MS);

  try {
    return await Promise.race([
      interrupted,
      (async () => {
        const response = await fetch(url, { ...init, signal: controller.signal });
        // Keep the deadline active while reading the body, not just the headers.
        // Buffer once so callers can retain the usual Response.json() interface.
        const body = await response.text();
        return new Response(body.length === 0 ? null : body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      })(),
    ]);
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', abort);
  }
}
