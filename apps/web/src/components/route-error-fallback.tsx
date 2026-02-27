import { useRouteError } from 'react-router-dom';
import { captureException } from '@/lib/sentry';

/**
 * React-router errorElement fallback. Catches errors that bypass
 * React error boundaries (e.g. failed lazy imports, loader errors)
 * and shows a branded reload page instead of the default dev error.
 */
export function RouteErrorFallback(): React.ReactNode {
  const error = useRouteError();

  captureException(error instanceof Error ? error : new Error(String(error)));

  return (
    <div className="min-h-screen flex items-center justify-center bg-body p-6">
      <div className="text-center max-w-md">
        <img
          src="/error-state.webp"
          alt="Error state — damaged gravity chamber"
          width={512}
          height={279}
          className="w-full max-w-sm mx-auto mb-8 rounded-sm opacity-80"
        />
        <h1 className="text-2xl font-bold text-main mb-3">Algo ha salido mal</h1>
        <p className="text-muted mb-6">
          Ha ocurrido un error inesperado. Recargar la página debería solucionarlo.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-accent text-white font-bold cursor-pointer"
        >
          Recargar
        </button>
      </div>
    </div>
  );
}
