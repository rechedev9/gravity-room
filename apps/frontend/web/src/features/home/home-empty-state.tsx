import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/button';

interface HomeEmptyStateProps {
  readonly variant: 'guest' | 'no-program';
}

export function HomeEmptyState({ variant }: HomeEmptyStateProps): React.ReactNode {
  const { t } = useTranslation();

  return (
    <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-elevated)] p-8 sm:p-12 text-center">
      {variant === 'guest' ? (
        <>
          <p className="chalk-stamp text-label">{t('home.empty.guest_stamp')}</p>
          <h1 className="font-display text-4xl sm:text-6xl text-main my-4">
            {t('home.empty.guest_title')}
          </h1>
          <p className="text-muted mb-6 max-w-sm mx-auto leading-relaxed">
            {t('home.empty.guest_body')}
          </p>
          <Link to="/login">
            <Button variant="primary">{t('home.empty.guest_cta')}</Button>
          </Link>
        </>
      ) : (
        <>
          <p className="chalk-stamp text-label">{t('home.empty.no_program_stamp')}</p>
          <h1 className="font-display text-4xl sm:text-6xl text-main my-4">
            {t('home.empty.no_program_title')}
          </h1>
          <p className="text-muted mb-6 max-w-sm mx-auto leading-relaxed">
            {t('home.empty.no_program_body')}
          </p>
          <Link to="/app/programs">
            <Button variant="primary">{t('home.empty.no_program_cta')}</Button>
          </Link>
        </>
      )}
    </section>
  );
}
