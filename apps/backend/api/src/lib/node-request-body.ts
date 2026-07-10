import type { Readable } from 'node:stream';

export class PayloadTooLargeError extends Error {
  constructor() {
    super('Payload too large');
    this.name = 'PayloadTooLargeError';
  }
}

/** True only for a valid declared length that exceeds the configured limit. */
export function declaredBodyTooLarge(contentLength: string | undefined, maxBytes: number): boolean {
  if (!contentLength) return false;
  const length = Number(contentLength);
  return Number.isSafeInteger(length) && length > maxBytes;
}

/**
 * Materialize a Node request body while enforcing the limit during streaming.
 * The stream is paused as soon as the limit is crossed so an attacker cannot
 * force the process to buffer the complete payload before receiving a 413.
 */
export function readLimitedBody(stream: Readable, maxBytes: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;

    const cleanup = (): void => {
      stream.removeListener('data', onData);
      stream.removeListener('end', onEnd);
      stream.removeListener('error', onError);
    };
    const onData = (chunk: Buffer | string): void => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buffer.length;
      if (totalBytes > maxBytes) {
        cleanup();
        stream.pause();
        reject(new PayloadTooLargeError());
        return;
      }
      chunks.push(buffer);
    };
    const onEnd = (): void => {
      cleanup();
      resolve(Buffer.concat(chunks, totalBytes));
    };
    const onError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    stream.on('data', onData);
    stream.on('end', onEnd);
    stream.on('error', onError);
  });
}
