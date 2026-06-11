import { useTranslation } from 'react-i18next';
import { DISCORD_URL } from '@/features/landing/shared';
import { useOnlineCount } from '@/hooks/use-online-count';
import { cn } from '@/lib/cn';

interface OnlineIndicatorProps {
  readonly inline?: boolean;
}

export function OnlineIndicator({ inline = false }: OnlineIndicatorProps): React.ReactNode {
  const { t } = useTranslation();
  const count = useOnlineCount();
  if (count === null) return null;

  return (
    <a
      href={DISCORD_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-2 bg-card border border-rule font-mono text-[11px] text-muted px-2 py-1 rounded-[var(--radius-base)] hover:text-main hover:border-rule-light transition-colors duration-200 select-none',
        !inline && 'fixed bottom-4 right-4 z-40'
      )}
      aria-label={t('online_indicator.aria_label', { count })}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-online animate-pulse" aria-hidden="true" />
      <span>{t('online_indicator.label', { count })}</span>
    </a>
  );
}
