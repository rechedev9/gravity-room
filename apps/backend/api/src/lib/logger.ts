import pino from 'pino';

const isProduction = process.env['NODE_ENV'] === 'production';
const isTest = process.env['NODE_ENV'] === 'test';

export const logger = pino({
  level: process.env['LOG_LEVEL'] ?? 'info',
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
});
