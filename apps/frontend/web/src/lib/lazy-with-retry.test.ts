import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { isChunkLoadError, handleChunkError } from './lazy-with-retry';

// ── sessionStorage mock ────────────────────────────────────────
const storage = new Map<string, string>();
const mockGetItem = mock((key: string) => storage.get(key) ?? null);
const mockSetItem = mock((key: string, value: string) => {
  storage.set(key, value);
});
Object.defineProperty(globalThis, 'sessionStorage', {
  value: { getItem: mockGetItem, setItem: mockSetItem },
  writable: true,
});

// ── window.location.reload mock ────────────────────────────────
const reloadMock = mock(() => {});
Object.defineProperty(window, 'location', {
  value: { ...window.location, reload: reloadMock },
  writable: true,
});

describe('isChunkLoadError', () => {
  it('detects Vite dynamic import failures', () => {
    const error = new TypeError(
      'Failed to fetch dynamically imported module: https://example.com/assets/page-abc123.js'
    );
    expect(isChunkLoadError(error)).toBe(true);
  });

  it('detects Safari-style import failures', () => {
    const error = new TypeError('Importing a module script failed');
    expect(isChunkLoadError(error)).toBe(true);
  });

  it('detects Firefox-style import failures', () => {
    const error = new TypeError('error loading dynamically imported module');
    expect(isChunkLoadError(error)).toBe(true);
  });

  it('detects webpack-style chunk failures', () => {
    expect(isChunkLoadError(new TypeError('Loading chunk 5 failed'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Loading CSS chunk 3 failed'))).toBe(true);
  });

  it('rejects non-TypeError errors', () => {
    expect(isChunkLoadError(new Error('Network error'))).toBe(false);
    expect(isChunkLoadError(new RangeError('out of range'))).toBe(false);
  });

  it('rejects TypeErrors with unrelated messages', () => {
    expect(isChunkLoadError(new TypeError('Cannot read property x of undefined'))).toBe(false);
  });

  it('rejects non-Error values', () => {
    expect(isChunkLoadError('string error')).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
    expect(isChunkLoadError(42)).toBe(false);
  });
});

describe('handleChunkError', () => {
  beforeEach(() => {
    storage.clear();
    mockGetItem.mockClear();
    mockSetItem.mockClear();
    reloadMock.mockClear();
  });

  it('reloads the page on first chunk error', () => {
    const error = new TypeError('Failed to fetch dynamically imported module');

    expect(() => handleChunkError(error)).toThrow();

    expect(reloadMock).toHaveBeenCalledTimes(1);
    expect(mockSetItem).toHaveBeenCalledWith('chunk-reload-ts', expect.any(String));
  });

  it('throws without reloading when already reloaded recently', () => {
    storage.set('chunk-reload-ts', String(Date.now()));
    const error = new TypeError('Failed to fetch dynamically imported module');

    expect(() => handleChunkError(error)).toThrow(error);

    expect(reloadMock).not.toHaveBeenCalled();
  });

  it('reloads again after cooldown expires', () => {
    storage.set('chunk-reload-ts', String(Date.now() - 15_000));
    const error = new TypeError('Failed to fetch dynamically imported module');

    expect(() => handleChunkError(error)).toThrow();

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });
});
