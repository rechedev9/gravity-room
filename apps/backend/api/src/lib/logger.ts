import pino from 'pino';
import { redactSensitiveText } from './redact-sensitive';

const isProduction = process.env['NODE_ENV'] === 'production';
const isTest = process.env['NODE_ENV'] === 'test';

export function secureErrorSerializer(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return { type: 'NonError', message: redactSensitiveText(String(error)) };
  }
  const serialized = pino.stdSerializers.err(error);
  return {
    ...serialized,
    ...(typeof serialized.message === 'string'
      ? { message: redactSensitiveText(serialized.message) }
      : {}),
    ...(typeof serialized.stack === 'string'
      ? { stack: redactSensitiveText(serialized.stack) }
      : {}),
  };
}

/**
 * Field paths Pino masks in every log record. Pino wildcards match exactly one
 * level, so each sensitive key is listed both bare (top-level) and `*.`-prefixed
 * (one object deep) as defense-in-depth — a stray credential logged under any
 * parent object is still redacted. The header paths preserve the original
 * coverage; the rest are common secret-bearing field names.
 */
export const loggerRedactPaths: string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  '*.headers.authorization',
  '*.headers.cookie',
  'authorization',
  '*.authorization',
  'cookie',
  '*.cookie',
  'password',
  '*.password',
  'passwordHash',
  '*.passwordHash',
  'password_hash',
  '*.password_hash',
  'token',
  '*.token',
  'tokenHash',
  '*.tokenHash',
  'token_hash',
  '*.token_hash',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'secret',
  '*.secret',
  'apiKey',
  '*.apiKey',
];

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  serializers: { ...pino.stdSerializers, err: secureErrorSerializer, error: secureErrorSerializer },
  redact: {
    paths: loggerRedactPaths,
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
});
