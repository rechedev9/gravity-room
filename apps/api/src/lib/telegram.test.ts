/**
 * telegram.ts unit tests — verifies send behavior, no-op paths, and error isolation.
 *
 * sendTelegramMessage is fire-and-forget (returns void). To test async behavior we
 * let the IIFE settle by awaiting a microtask flush via Promise.resolve().
 *
 * fetch is mocked on globalThis so it is intercepted by the module's internal
 * async IIFE without any import-time hooking.
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test';

// ---------------------------------------------------------------------------
// Logger mock — capture warn calls
// ---------------------------------------------------------------------------

const mockWarn = mock((): void => undefined);

mock.module('./logger', () => ({
  logger: {
    warn: mockWarn,
    info: mock(() => undefined),
    error: mock(() => undefined),
    debug: mock(() => undefined),
    child: mock(() => ({
      warn: mockWarn,
      info: mock(() => undefined),
      error: mock(() => undefined),
    })),
  },
}));

// ---------------------------------------------------------------------------
// fetch mock
// ---------------------------------------------------------------------------

const mockFetch = mock(
  (): Promise<Response> =>
    Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
);

// Must import AFTER mock.module
import { sendTelegramMessage } from './telegram';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flush the micro-task queue so fire-and-forget IIFEs settle. */
async function flushMicrotasks(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
}

// ---------------------------------------------------------------------------
// describe: sendTelegramMessage
// ---------------------------------------------------------------------------

describe('sendTelegramMessage', () => {
  const TOKEN = 'bot-token-abc';
  const CHAT_ID = '12345';

  beforeEach(() => {
    // Reset env and mocks before each test
    process.env['TELEGRAM_BOT_TOKEN'] = TOKEN;
    process.env['TELEGRAM_CHAT_ID'] = CHAT_ID;
    mockFetch.mockClear();
    mockWarn.mockClear();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    delete process.env['TELEGRAM_BOT_TOKEN'];
    delete process.env['TELEGRAM_CHAT_ID'];
  });

  // -------------------------------------------------------------------------
  // Task 4.1 — fetch called with correct URL and body
  // -------------------------------------------------------------------------

  it('calls fetch once with correct URL when credentials are present', async () => {
    // Arrange
    mockFetch.mockImplementation(
      () =>
        Promise.resolve(
          new Response(JSON.stringify({ ok: true }), { status: 200 })
        ) as Promise<Response>
    );

    // Act
    sendTelegramMessage('New user: foo@example.com | Desktop');
    await flushMicrotasks();

    // Assert
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
  });

  it('calls fetch with correct JSON body when credentials are present', async () => {
    // Arrange
    mockFetch.mockImplementation(
      () =>
        Promise.resolve(
          new Response(JSON.stringify({ ok: true }), { status: 200 })
        ) as Promise<Response>
    );
    const messageText = 'New user: foo@example.com | Desktop';

    // Act
    sendTelegramMessage(messageText);
    await flushMicrotasks();

    // Assert
    const [, init] = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(init?.body as string) as { chat_id: string; text: string };
    expect(body.chat_id).toBe(CHAT_ID);
    expect(body.text).toBe(messageText);
  });

  // -------------------------------------------------------------------------
  // Task 4.2 — fire-and-forget (returns void)
  // -------------------------------------------------------------------------

  it('returns void (not a Promise) so it can be called without await', () => {
    // Arrange & Act
    const result = sendTelegramMessage('hello');

    // Assert — void means the return value is undefined
    expect(result).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Task 4.3 — no-op when TELEGRAM_BOT_TOKEN is absent
  // -------------------------------------------------------------------------

  it('does not call fetch when TELEGRAM_BOT_TOKEN is absent', async () => {
    // Arrange
    delete process.env['TELEGRAM_BOT_TOKEN'];

    // Act
    sendTelegramMessage('test message');
    await flushMicrotasks();

    // Assert
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Task 4.4 — no-op when TELEGRAM_CHAT_ID is absent
  // -------------------------------------------------------------------------

  it('does not call fetch when TELEGRAM_CHAT_ID is absent', async () => {
    // Arrange
    delete process.env['TELEGRAM_CHAT_ID'];

    // Act
    sendTelegramMessage('test message');
    await flushMicrotasks();

    // Assert
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does not call fetch when TELEGRAM_BOT_TOKEN is empty string', async () => {
    // Arrange
    process.env['TELEGRAM_BOT_TOKEN'] = '';

    // Act
    sendTelegramMessage('test message');
    await flushMicrotasks();

    // Assert
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Task 4.5 — error caught and logged (non-2xx response)
  // -------------------------------------------------------------------------

  it('logs a warn and does not throw when fetch returns non-2xx', async () => {
    // Arrange
    mockFetch.mockImplementation(
      () =>
        Promise.resolve(
          new Response(JSON.stringify({ description: 'Bad Request' }), { status: 400 })
        ) as Promise<Response>
    );

    // Act — must not throw
    let threw = false;
    try {
      sendTelegramMessage('test');
      await flushMicrotasks();
    } catch {
      threw = true;
    }

    // Assert
    expect(threw).toBe(false);
    expect(mockWarn).toHaveBeenCalledTimes(1);
  });

  it('logs a warn and does not throw when fetch throws a network error', async () => {
    // Arrange
    mockFetch.mockImplementation((): Promise<Response> => {
      throw new Error('ECONNREFUSED');
    });

    // Act
    let threw = false;
    try {
      sendTelegramMessage('test');
      await flushMicrotasks();
    } catch {
      threw = true;
    }

    // Assert
    expect(threw).toBe(false);
    expect(mockWarn).toHaveBeenCalledTimes(1);
  });
});
