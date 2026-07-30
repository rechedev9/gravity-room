import { afterEach } from 'vitest';
// Registers the @testing-library/jest-dom matchers on vitest's expect and
// augments the vitest type definitions in one import.
import '@testing-library/jest-dom/vitest';
// Note: virtual:pwa-register/react is resolved to a stub via vitest.config.ts
// (resolve.alias), so no module mock is needed here.
import { cleanup } from '@testing-library/react';
// Import the app's i18n instance to ensure it is resolved and initialized
// before any component import does so asynchronously.
import i18n from '../src/lib/i18n/index';
import en from '../src/lib/i18n/locales/en/translation.json';
import es from '../src/lib/i18n/locales/es/translation.json';

/**
 * Node 25 can install an incomplete experimental localStorage that shadows
 * happy-dom's (missing clear(), flaky getItem after setItem). Prefer a simple
 * in-memory store for unit tests when the global is broken.
 */
function ensureUsableLocalStorage(): void {
  let broken = false;
  try {
    const probe = '__gr_ls_probe__';
    localStorage.setItem(probe, '1');
    if (localStorage.getItem(probe) !== '1' || typeof localStorage.clear !== 'function') {
      broken = true;
    }
    localStorage.removeItem(probe);
  } catch {
    broken = true;
  }
  if (!broken) return;

  const store = new Map<string, string>();
  const memory: Storage = {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) ?? null) : null;
    },
    key(index: number) {
      return [...store.keys()][index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: memory,
  });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      writable: true,
      value: memory,
    });
  }
}

ensureUsableLocalStorage();

// Keep translations deterministic in tests regardless of detected browser locale.
// Do not mock react-i18next globally so unrelated test files don't see raw-key
// translations leak in.
if (!i18n.isInitialized) {
  await new Promise<void>((resolve) => {
    i18n.on('initialized', () => resolve());
  });
}
i18n.addResourceBundle('es', 'translation', es, true, true);
i18n.addResourceBundle('en', 'translation', en, true, true);
// Disable suspense so useTranslation resolves synchronously during tests
i18n.options.react = { ...i18n.options.react, useSuspense: false };
void i18n.changeLanguage('es');

afterEach(() => {
  cleanup();
  localStorage.clear();
  // Reset language to Spanish after each test in case a test changed it
  void i18n.changeLanguage('es');
});
