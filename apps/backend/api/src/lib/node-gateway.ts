import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { logger } from './logger';
import { PayloadTooLargeError, declaredBodyTooLarge, readLimitedBody } from './node-request-body';

export const MAX_GATEWAY_BODY_BYTES = 1_048_576;
export const MAX_NON_STREAMING_RESPONSE_BYTES = 1_048_576;

type AppFetch = (request: Request) => Response | Promise<Response>;

class NonStreamingResponseTooLargeError extends Error {}

function setFallbackHeaders(res: ServerResponse, requestId: string): void {
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-request-id', requestId);
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: Readonly<Record<string, string>>,
  requestId: string
): void {
  if (res.headersSent || res.writableEnded) return;
  res.statusCode = status;
  setFallbackHeaders(res, requestId);
  res.end(JSON.stringify(body));
}

function applyWebResponseHeaders(res: ServerResponse, response: Response): void {
  res.statusCode = response.status;
  const cookies = response.headers.getSetCookie();
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    res.setHeader(key, value);
  });
  if (cookies.length > 0) res.setHeader('set-cookie', cookies);
}

function waitForDrain(res: ServerResponse): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = (): void => {
      res.off('drain', onDrain);
      res.off('error', onError);
      res.off('close', onClose);
    };
    const onDrain = (): void => {
      cleanup();
      resolve();
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };
    const onClose = (): void => {
      cleanup();
      reject(new Error('Node response closed during backpressure'));
    };
    res.once('drain', onDrain);
    res.once('error', onError);
    res.once('close', onClose);
  });
}

async function writeFallbackResponse(res: ServerResponse, response: Response): Promise<void> {
  const declaredLength = response.headers.get('content-length');
  if (declaredBodyTooLarge(declaredLength ?? undefined, MAX_NON_STREAMING_RESPONSE_BYTES)) {
    throw new NonStreamingResponseTooLargeError();
  }
  const body = new Uint8Array(await response.arrayBuffer());
  if (body.byteLength > MAX_NON_STREAMING_RESPONSE_BYTES) {
    throw new NonStreamingResponseTooLargeError();
  }
  applyWebResponseHeaders(res, response);
  res.end(body);
}

async function writeWebResponse(res: ServerResponse, response: Response): Promise<void> {
  if (!response.body) {
    applyWebResponseHeaders(res, response);
    res.end();
    return;
  }

  // Standards-compliant Node/Vercel Response implementations expose a Web
  // ReadableStream. Keep the small bounded fallback only for incomplete test or
  // platform mocks; never materialize an unbounded app response.
  const stream = response.body;
  if (typeof stream.getReader !== 'function') {
    await writeFallbackResponse(res, response);
    return;
  }

  const reader = stream.getReader();
  let started = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!started) {
        // Delay header commitment until the first successful read. A stream that
        // fails immediately can still become the controlled JSON 500 boundary.
        applyWebResponseHeaders(res, response);
        started = true;
      }
      if (value.byteLength > 0 && !res.write(value)) await waitForDrain(res);
    }
    if (!started) applyWebResponseHeaders(res, response);
    res.end();
  } catch (error: unknown) {
    await reader.cancel(error).catch(() => undefined);
    if (res.headersSent) res.destroy(error instanceof Error ? error : undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}

function webRequestFromNode(
  req: IncomingMessage,
  method: string,
  body: Buffer | undefined
): Request {
  const url = `https://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`;
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else {
      headers.set(key, value);
    }
  }

  const requestBody = body === undefined ? undefined : Uint8Array.from(body).buffer;
  return new Request(url, {
    method,
    headers,
    ...(requestBody !== undefined ? { body: requestBody } : {}),
  });
}

/** Build the Vercel Node-to-Fetch gateway around an injected app.fetch function. */
export function createNodeGateway(appFetch: AppFetch) {
  return async function nodeGateway(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestId = randomUUID();
    try {
      const method = (req.method ?? 'GET').toUpperCase();
      const hasBody = method !== 'GET' && method !== 'HEAD';

      let body: Buffer | undefined;
      if (hasBody) {
        const contentLength = Array.isArray(req.headers['content-length'])
          ? req.headers['content-length'][0]
          : req.headers['content-length'];
        if (declaredBodyTooLarge(contentLength, MAX_GATEWAY_BODY_BYTES)) {
          sendJson(res, 413, { error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' }, requestId);
          return;
        }
        body = await readLimitedBody(req, MAX_GATEWAY_BODY_BYTES);
      }

      const response = await appFetch(webRequestFromNode(req, method, body));
      await writeWebResponse(res, response);
    } catch (error: unknown) {
      if (error instanceof NonStreamingResponseTooLargeError) {
        sendJson(
          res,
          502,
          { error: 'Upstream response too large', code: 'RESPONSE_TOO_LARGE' },
          requestId
        );
        return;
      }
      if (error instanceof PayloadTooLargeError) {
        sendJson(res, 413, { error: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' }, requestId);
        return;
      }

      logger.error({ err: error, requestId }, 'node gateway request failed');
      sendJson(res, 500, { error: 'Internal server error', code: 'INTERNAL_ERROR' }, requestId);
    }
  };
}
