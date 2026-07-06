import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/button';
import { localizedProgramName } from '@/lib/catalog-display';

interface HomeGuestResumeProps {
  /** Catalog program id, used both for the localized name and the tracker link. */
  readonly programId: string;
  /** Stored (un-localized) program name - fallback when no catalog translation exists. */
  readonly programName: string;
}

/**
 * Guest "continue where you left off" hero. Guests keep their in-progress
 * program in localStorage (see lib/guest-storage.ts), so a returning guest is
 * offered a direct link back into the tracker instead of the generic empty
 * state.
 */
export function HomeGuestResume({ programId, programName }: HomeGuestResumeProps): React.ReactNode {
  const { t } = useTranslation();
  const displayName = localizedProgramName(t, programId, programName);

  return (
    <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-elevated)] p-8 sm:p-12 text-center">
      <p className="chalk-stamp text-label">{t('home.guest_resume.stamp')}</p>
      <h1 className="font-display text-4xl sm:text-6xl text-main my-4">{displayName}</h1>
      <p className="text-muted mb-6 max-w-sm mx-auto leading-relaxed">
        {t('home.guest_resume.body')}
      </p>
      <Link to="/app/tracker/$programId" params={{ programId }}>
        <Button variant="primary">{t('home.guest_resume.cta')}</Button>
      </Link>
    </section>
  );
}
