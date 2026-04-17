import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { ProgramsIcon } from '@/components/layout/sidebar-icons';
import { Button } from '@/components/button';

interface HomeEmptyStateProps {
  readonly variant: 'guest' | 'no-program';
}

export function HomeEmptyState({ variant }: HomeEmptyStateProps): React.ReactNode {
  const { t } = useTranslation();

  return (
    <div className="bg-card border border-rule p-8 text-center">
      <div className="w-10 h-10 mx-auto flex items-center justify-center border border-rule text-muted mb-4">
        <ProgramsIcon />
      </div>

      {variant === 'guest' ? (
        <>
          <p className="text-sm font-bold text-main mb-1">{t('home.empty.guest_title')}</p>
          <p className="text-xs text-muted mb-5 max-w-sm mx-auto leading-relaxed">
            {t('home.empty.guest_body')}
          </p>
          <Link to="/login">
            <Button variant="primary">{t('home.empty.guest_cta')}</Button>
          </Link>
        </>
      ) : (
        <>
          <p className="text-sm font-bold text-main mb-1">{t('home.empty.no_program_title')}</p>
          <p className="text-xs text-muted mb-5 max-w-sm mx-auto leading-relaxed">
            {t('home.empty.no_program_body')}
          </p>
          <Link to="/app/programs">
            <Button variant="primary">{t('home.empty.no_program_cta')}</Button>
          </Link>
        </>
      )}
    </div>
  );
}
