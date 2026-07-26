import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { buttonClassName } from '@/components/button';

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
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/app/programs" className={buttonClassName({ variant: 'primary' })}>
              {t('home.empty.guest_programs_cta')}
            </Link>
            <Link to="/app/exercises" className={buttonClassName()}>
              {t('home.empty.guest_wiki_cta')}
            </Link>
          </div>
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
          <Link to="/app/programs" className={buttonClassName({ variant: 'primary' })}>
            {t('home.empty.no_program_cta')}
          </Link>
        </>
      )}
    </section>
  );
}
