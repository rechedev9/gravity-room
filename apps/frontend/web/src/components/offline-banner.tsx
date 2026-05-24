import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '@/hooks/use-network-status';

export function OfflineBanner(): React.ReactNode {
  const { t } = useTranslation();
  const { isOnline } = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 px-4 py-2.5 bg-card border-b border-accent text-xs font-bold text-main animate-[fadeSlideDown_0.2s_ease-out]"
    >
      <span className="w-2 h-2 rounded-full bg-error shrink-0" aria-hidden="true" />
      {t('offline_banner.message')}
    </div>
  );
}
