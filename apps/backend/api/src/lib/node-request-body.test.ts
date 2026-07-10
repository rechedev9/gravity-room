import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { PayloadTooLargeError, declaredBodyTooLarge, readLimitedBody } from './node-request-body';

describe('declaredBodyTooLarge', () => {
  it('rejects a declared payload above the limit', () => {
    expect(declaredBodyTooLarge('1025', 1024)).toBe(true);
  });

  it('does not trust malformed lengths as proof of size', () => {
    expect(declaredBodyTooLarge('not-a-number', 1024)).toBe(false);
  });
});

describe('readLimitedBody', () => {
  it('returns a body within the limit', async () => {
    const stream = new PassThrough();
    const bodyPromise = readLimitedBody(stream, 8);
    stream.end('12345678');

    await expect(bodyPromise).resolves.toEqual(Buffer.from('12345678'));
  });

  it('stops buffering as soon as streamed chunks cross the limit', async () => {
    const stream = new PassThrough();
    const bodyPromise = readLimitedBody(stream, 4);
    stream.write('1234');
    stream.write('5');

    await expect(bodyPromise).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(stream.isPaused()).toBe(true);
  });
});
