// Stub for the `virtual:pwa-register/react` module, which is provided by
// vite-plugin-pwa at build/dev time but is absent in the vitest environment.
// Aliased in vitest.config.ts so component imports resolve to this no-op.
export function useRegisterSW(): {
  needRefresh: [boolean, (value: boolean) => void];
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
} {
  return {
    needRefresh: [false, () => {}],
    updateServiceWorker: () => Promise.resolve(),
  };
}
