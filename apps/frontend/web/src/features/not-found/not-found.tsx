import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { useHead } from '@/hooks/use-head';

export function NotFound(): React.ReactNode {
  const { t } = useTranslation();
  useHead({ robots: 'noindex, follow' });
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-body px-6 text-center relative overflow-hidden">
      <img
        src="/logo-192.webp"
        alt={t('not_found.logo_alt')}
        width={64}
        height={64}
        className="rounded-full mb-8 relative"
      />
      <h1 className="font-display text-7xl sm:text-8xl text-title mb-3 relative">404</h1>
      <p className="text-sm text-muted mb-8 max-w-xs relative">{t('not_found.message')}</p>
      <Link
        to="/"
        className="px-6 py-3 text-xs font-bold border-2 border-btn-ring bg-btn-active text-btn-active-text hover:opacity-90 transition-all active:scale-[0.97] relative"
      >
        {t('not_found.go_home')}
      </Link>
    </div>
  );
}
