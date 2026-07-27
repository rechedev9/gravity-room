import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';

interface InstallEvent {
  waitUntil(promise: Promise<unknown>): void;
}

describe('PWA cache upgrade migration', () => {
  async function runMigration({
    legacyCacheExists,
  }: {
    readonly legacyCacheExists: boolean;
  }): Promise<{
    readonly deleteCache: ReturnType<typeof vi.fn>;
    readonly skipWaiting: ReturnType<typeof vi.fn>;
  }> {
    const source = await readFile(resolve(process.cwd(), 'public/pwa-cache-migrations.js'), 'utf8');
    let install: ((event: InstallEvent) => void) | undefined;
    const hasCache = vi.fn(() => Promise.resolve(legacyCacheExists));
    const deleteCache = vi.fn(() => Promise.resolve(true));
    const skipWaiting = vi.fn(() => Promise.resolve());

    runInNewContext(source, {
      caches: { delete: deleteCache, has: hasCache },
      self: {
        addEventListener(type: string, handler: (event: InstallEvent) => void): void {
          if (type === 'install') install = handler;
        },
        skipWaiting,
      },
    });

    if (install === undefined) {
      throw new Error('Cache migration did not register an install handler');
    }

    let migration: Promise<unknown> | undefined;
    install({
      waitUntil(promise) {
        migration = promise;
      },
    });

    if (migration === undefined) {
      throw new Error('Cache migration did not extend the activate event');
    }
    await migration;

    expect(hasCache).toHaveBeenCalledWith('api-cache');
    expect(deleteCache).toHaveBeenCalledOnce();
    expect(deleteCache).toHaveBeenCalledWith('api-cache');
    expect(deleteCache).not.toHaveBeenCalledWith('public-api-cache-v2');

    return { deleteCache, skipWaiting };
  }

  it('deletes the legacy cache and immediately replaces the vulnerable worker', async () => {
    const { skipWaiting } = await runMigration({ legacyCacheExists: true });

    expect(skipWaiting).toHaveBeenCalledOnce();
  });

  it('retains prompt-based updates for installations without the legacy cache', async () => {
    const { skipWaiting } = await runMigration({ legacyCacheExists: false });

    expect(skipWaiting).not.toHaveBeenCalled();
  });
});
