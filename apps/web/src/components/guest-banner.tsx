import { useTranslation } from 'react-i18next';
import { useNavigate } from '@tanstack/react-router';
import { useGuest } from '@/contexts/guest-context';

interface GuestBannerProps {
  readonly className?: string;
}

export function GuestBanner({ className }: GuestBannerProps): React.ReactNode {
  const { t } = useTranslation();
  const { exitGuestMode } = useGuest();
  const navigate = useNavigate();

  const handleCreateAccount = (): void => {
    exitGuestMode();
    void navigate({ to: '/login' });
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs bg-card border border-rule ${className ?? ''}`}
    >
      <span className="text-muted">
        {t('guest_banner.mode')} &mdash; {t('guest_banner.prompt')}
      </span>
      <button
        type="button"
        onClick={handleCreateAccount}
        className="font-bold text-[10px] tracking-widest uppercase px-3 py-1.5 border-2 border-btn-ring bg-btn-active text-btn-active-text cursor-pointer transition-all duration-150 hover:opacity-90 active:scale-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
        aria-label={t('guest_banner.create_account_aria')}
      >
        {t('guest_banner.create_account')}
      </button>
    </div>
  );
}
