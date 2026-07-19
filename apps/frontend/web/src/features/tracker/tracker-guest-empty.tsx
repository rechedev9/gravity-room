import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/button';

/**
 * Shown when a guest lands on /app/tracker without an in-progress program.
 * Guests CAN track locally (see hooks/use-guest-program.ts) — they just need
 * to pick a program from the catalog first — so instead of bouncing them back
 * to the home wall this points them straight at the catalog.
 */
export function TrackerGuestEmpty(): React.ReactNode {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh bg-body">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <section className="bg-card border border-rule rounded-[var(--radius-base)] shadow-[var(--shadow-elevated)] p-8 sm:p-12 text-center">
          <p className="chalk-stamp text-label">{t('tracker.guest_empty.stamp')}</p>
          <h1 className="font-display text-4xl sm:text-6xl text-main my-4">
            {t('tracker.guest_empty.title')}
          </h1>
          <p className="text-muted mb-6 max-w-sm mx-auto leading-relaxed">
            {t('tracker.guest_empty.body')}
          </p>
          <Link to="/app/programs">
            <Button variant="primary">{t('tracker.guest_empty.cta')}</Button>
          </Link>
        </section>
      </div>
    </div>
  );
}
