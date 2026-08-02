process.env['LOG_LEVEL'] = 'silent';

import { createServer, type RequestListener } from 'node:http';
import { Elysia } from 'elysia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNodeGateway, MAX_NON_STREAMING_RESPONSE_BYTES } from './node-gateway';

const servers: ReturnType<typeof createServer>[] = [];

async function serve(listener: RequestListener): Promise<string> {
  const server = createServer(listener);
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected TCP server address');
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  const closing = servers.splice(0).map(
    (server) =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      })
  );
  await Promise.all(closing);
});

describe('Node gateway', () => {
  it('bridges a real Node request through an Elysia app.fetch', async () => {
    const app = new Elysia().get('/api/echo', ({ request }) => ({
      method: request.method,
      path: new URL(request.url).pathname,
    }));
    const gateway = createNodeGateway((request) => app.fetch(request));
    const baseUrl = await serve((request, response) => {
      void gateway(request, response);
    });

    const response = await fetch(`${baseUrl}/api/echo`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ method: 'GET', path: '/api/echo' });
  });

  it('turns an app.fetch rejection into a controlled JSON 500', async () => {
    const gateway = createNodeGateway(() => Promise.reject(new Error('adapter secret')));
    const baseUrl = await serve((request, response) => {
      void gateway(request, response);
    });

    const response = await fetch(`${baseUrl}/api/nope`);

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-request-id')).toMatch(/^[\w-]{8,64}$/);
  });

  it('streams a multi-megabyte response without imposing an in-memory response cap', async () => {
    const chunk = new Uint8Array(64 * 1024).fill(0x61);
    const chunkCount = 80;
    let pulls = 0;
    const gateway = createNodeGateway(() =>
      Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              if (pulls >= chunkCount) {
                controller.close();
                return;
              }
              controller.enqueue(chunk);
              pulls += 1;
            },
          }),
          { headers: { 'content-type': 'application/octet-stream' } }
        )
      )
    );
    const baseUrl = await serve((request, response) => {
      void gateway(request, response);
    });

    const response = await fetch(`${baseUrl}/api/large`);
    const body = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(body.byteLength).toBe(chunk.byteLength * chunkCount);
    expect(body[0]).toBe(0x61);
    expect(body.at(-1)).toBe(0x61);
    expect(pulls).toBe(chunkCount);
  });

  it('returns controlled JSON 500 when a response stream fails before headers are sent', async () => {
    const gateway = createNodeGateway(() =>
      Promise.resolve(
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error('stream secret'));
            },
          })
        )
      )
    );
    const baseUrl = await serve((request, response) => {
      void gateway(request, response);
    });

    const response = await fetch(`${baseUrl}/api/broken`);
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  });

  it('terminates a partially-started response when its stream fails', async () => {
    let pullCount = 0;
    const gateway = createNodeGateway(() =>
      Promise.resolve(
        new Response(
          new ReadableStream<Uint8Array>({
            pull(controller) {
              if (pullCount === 0) {
                controller.enqueue(new TextEncoder().encode('partial'));
                pullCount += 1;
                return;
              }
              controller.error(new Error('late stream failure'));
            },
          })
        )
      )
    );
    const baseUrl = await serve((request, response) => {
      void gateway(request, response);
    });

    await expect(
      fetch(`${baseUrl}/api/partially-broken`).then((response) => response.text())
    ).rejects.toThrow();
  });

  it('rejects an oversized non-streaming platform fallback before materializing it', async () => {
    const arrayBuffer = vi.fn(() => Promise.resolve(new ArrayBuffer(0)));
    const nonStreamingMock = {
      status: 200,
      headers: new Headers({
        'content-length': String(MAX_NON_STREAMING_RESPONSE_BYTES + 1),
      }),
      body: {},
      arrayBuffer,
    } as unknown as Response;
    const gateway = createNodeGateway(() => Promise.resolve(nonStreamingMock));
    const baseUrl = await serve((request, response) => {
      void gateway(request, response);
    });

    const response = await fetch(`${baseUrl}/api/non-streaming`);
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
    expect(arrayBuffer).not.toHaveBeenCalled();
  });

  it('preserves multiple Set-Cookie headers', async () => {
    const gateway = createNodeGateway(() => {
      const headers = new Headers();
      headers.append('set-cookie', 'first=1; Path=/; HttpOnly');
      headers.append('set-cookie', 'second=2; Path=/; HttpOnly');
      return Promise.resolve(new Response(null, { status: 204, headers }));
    });
    const baseUrl = await serve((request, response) => {
      void gateway(request, response);
    });

    const response = await fetch(`${baseUrl}/api/cookies`);

    expect(response.status).toBe(204);
    expect(response.headers.getSetCookie()).toEqual([
      'first=1; Path=/; HttpOnly',
      'second=2; Path=/; HttpOnly',
    ]);
  });
});
