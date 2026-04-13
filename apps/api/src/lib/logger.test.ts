/**
 * Logger tests — verify Pino config: header redaction, error message retention,
 * and no pino-pretty transport in the test environment (NODE_ENV=test).
 *
 * Strategy: create a fresh pino instance with the same config as the exported
 * logger, but with a custom Writable destination to capture output in-process.
 * NODE_ENV is already 'test' in bun:test, so the transport block is skipped.
 */
process.env['LOG_LEVEL'] = 'silent';

import { describe, it, expect } from 'bun:test';
import pino from 'pino';
import { Writable } from 'stream';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a fresh pino instance with the same production config as logger.ts
 * but writes to a captured string buffer instead of stdout.
 * Returns both the logger and a getter for the captured output.
 */
function createTestLogger(): { log: pino.Logger; getOutput: () => string } {
  let captured = '';
  const dest = new Writable({
    write(chunk: Buffer, _encoding: string, cb: () => void): void {
      captured += chunk.toString();
      cb();
    },
  });

  const isProduction = process.env['NODE_ENV'] === 'production';
  const isTest = process.env['NODE_ENV'] === 'test';

  const log = pino(
    {
      level: 'trace',
      serializers: pino.stdSerializers,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          '*.headers.authorization',
          '*.headers.cookie',
        ],
        censor: '[Redacted]',
      },
      ...(!isProduction && !isTest
        ? {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
              },
            },
          }
        : {}),
    },
    dest
  );

  return { log, getOutput: () => captured };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('logger — header redaction', () => {
  it('4.4: authorization header value is NOT present in serialized output', () => {
    // Arrange
    const { log, getOutput } = createTestLogger();

    // Act
    log.info({ req: { headers: { authorization: 'Bearer eyJ_SENTINEL' } } }, 'test');

    // Assert
    expect(getOutput()).not.toContain('eyJ_SENTINEL');
  });

  it('4.5: cookie header value is NOT present in serialized output', () => {
    // Arrange
    const { log, getOutput } = createTestLogger();

    // Act
    log.info({ req: { headers: { cookie: 'refresh_token=COOKIE_SENTINEL' } } }, 'test');

    // Assert
    expect(getOutput()).not.toContain('COOKIE_SENTINEL');
  });

  it('4.6: err.message IS present in serialized output after redaction', () => {
    // Arrange
    const { log, getOutput } = createTestLogger();

    // Act
    log.info({ err: new Error('Invalid audience') }, 'test');

    // Assert
    const output = getOutput();
    const parsed = JSON.parse(output) as Record<string, unknown>;
    const err = parsed['err'] as Record<string, unknown>;
    expect(err['message']).toBe('Invalid audience');
  });

  it('4.7: transport is plain JSON in test env — output is valid JSON with no ANSI codes', () => {
    // Arrange
    const { log, getOutput } = createTestLogger();

    // Act
    log.info({ event: 'test.event' }, 'checking transport');

    // Assert: output must be parseable JSON
    const output = getOutput().trim();
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(typeof parsed['msg']).toBe('string');

    // Assert: no ANSI escape codes (pino-pretty colorization)
    const ansiPattern = /\u001b\[/;
    expect(ansiPattern.test(output)).toBe(false);
  });
});
