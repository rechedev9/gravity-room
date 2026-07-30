import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { EmptyState } from '@/components/empty-state';
import { buttonClassName } from '@/components/button';

interface HomeEmptyStateProps {
  readonly variant: 'guest' | 'no-program';
}

/**
 * Home empty surfaces — thin wrappers around the shared EmptyState so guest and
 * no-program keep the Forged Iron kicker + display voice without diverging CSS.
 */
export function HomeEmptyState({ variant }: HomeEmptyStateProps): React.ReactNode {
  const { t } = useTranslation();

  if (variant === 'guest') {
    return (
      <EmptyState
        kicker={t('home.empty.guest_stamp')}
        title={t('home.empty.guest_title')}
        body={t('home.empty.guest_body')}
        action={{ label: t('home.empty.guest_programs_cta'), to: '/app/programs' }}
        className="py-10 sm:py-14"
      >
        {/* Secondary CTA kept as a peer of the gold primary (not a second gold). */}
        <div className="mt-3">
          <Link to="/app/exercises" className={buttonClassName()}>
            {t('home.empty.guest_wiki_cta')}
          </Link>
        </div>
      </EmptyState>
    );
  }

  return (
    <EmptyState
      kicker={t('home.empty.no_program_stamp')}
      title={t('home.empty.no_program_title')}
      body={t('home.empty.no_program_body')}
      action={{ label: t('home.empty.no_program_cta'), to: '/app/programs' }}
      className="py-10 sm:py-14"
    />
  );
}
