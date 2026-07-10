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

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
  serializers: { ...pino.stdSerializers, err: secureErrorSerializer, error: secureErrorSerializer },
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
});
