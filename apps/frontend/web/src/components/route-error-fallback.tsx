import type { ErrorComponentProps } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { captureException } from '@/lib/sentry';

/**
 * TanStack Router errorComponent fallback. Catches errors that bypass
 * React error boundaries (e.g. failed lazy imports, loader errors)
 * and shows a branded reload page instead of the default dev error.
 */
export function RouteErrorFallback({ error }: ErrorComponentProps): React.ReactNode {
  const { t } = useTranslation();

  captureException(error instanceof Error ? error : new Error(String(error)));

  return (
    <div className="min-h-screen flex items-center justify-center bg-body p-6">
      <div className="text-center max-w-md">
        <img
          src="/error-state.webp"
          alt={t('route_error.image_alt')}
          width={512}
          height={279}
          className="w-full max-w-sm mx-auto mb-8 rounded-sm opacity-80"
        />
        <h1 className="text-2xl font-bold text-main mb-3">{t('route_error.title')}</h1>
        <p className="text-muted mb-6">{t('route_error.description')}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2.5 bg-accent text-on-accent font-bold cursor-pointer"
        >
          {t('route_error.reload')}
        </button>
      </div>
    </div>
  );
}
