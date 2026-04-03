import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Persistent banner shown when a new service worker is waiting to activate.
 * The user must explicitly confirm the reload — auto-reloading mid-session
 * would lose any unsaved tracker state.
 */
export function SwUpdatePrompt(): React.ReactNode {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-0 left-0 right-0 z-[150] flex items-center justify-between gap-3 px-4 py-3 bg-header border-t border-rule text-xs font-bold text-main sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:w-auto sm:border sm:border-rule sm:rounded-none"
    >
      <span>Nueva versión disponible</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => void updateServiceWorker(true)}
          className="px-3 py-1.5 bg-accent text-white font-bold cursor-pointer hover:opacity-90 transition-opacity"
        >
          Actualizar
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="min-h-[36px] min-w-[36px] flex items-center justify-center text-muted hover:text-title bg-transparent border-none cursor-pointer transition-colors"
          aria-label="Cerrar"
        >
          &#10005;
        </button>
      </div>
    </div>
  );
}
