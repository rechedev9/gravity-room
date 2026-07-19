import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from '@tanstack/react-router';

const COOKIE_BANNER_KEY = 'cookie-banner-dismissed';

export function CookieBanner(): React.ReactNode {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(COOKIE_BANNER_KEY)) {
      setVisible(true);
    }
  }, []);

  function dismiss(): void {
    localStorage.setItem(COOKIE_BANNER_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    // The full-width wrapper is transparent outside the card; without
    // `pointer-events-none` it would intercept clicks across the entire bottom
    // strip (e.g. the sidebar's user menu). The inner card re-enables pointer
    // events for its own interactive content.
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6 pointer-events-none">
      <div className="pointer-events-auto max-w-3xl mx-auto bg-card border border-rule rounded-lg shadow-elevated px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-muted leading-relaxed flex-1">
          {t('cookie_banner.message')}{' '}
          <Link to="/cookies" className="text-accent underline hover:opacity-80 transition-opacity">
            {t('cookie_banner.learn_more')}
          </Link>
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 px-5 py-2 text-sm font-bold rounded-md border border-btn-ring text-btn-text bg-btn hover:bg-btn-active hover:text-btn-active-text transition-colors cursor-pointer"
        >
          {t('cookie_banner.accept')}
        </button>
      </div>
    </div>
  );
}
