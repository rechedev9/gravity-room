import { useTranslation } from 'react-i18next';
import { formatDaysAgo } from './format-days-ago';

interface HomeHeaderProps {
  readonly userName: string | null;
  readonly streakDays: number | null;
  readonly daysSinceLast: number | null;
}

export function HomeHeader({
  userName,
  streakDays,
  daysSinceLast,
}: HomeHeaderProps): React.ReactNode {
  const { t } = useTranslation();
  const hasStats = streakDays !== null || daysSinceLast !== null;

  return (
    <header>
      <h1 className="font-display text-xl sm:text-2xl text-title tracking-wide">
        {userName
          ? t('home.header.greeting_named', { name: userName })
          : t('home.header.greeting_generic')}
      </h1>
      {hasStats && (
        <p className="font-mono text-[11px] text-muted mt-1 tracking-wide">
          {streakDays !== null && streakDays > 0 && (
            <span>
              {t('home.header.streak_inline', { count: streakDays })}
              {daysSinceLast !== null && ' · '}
            </span>
          )}
          {daysSinceLast !== null && (
            <span>
              {t('home.header.last_session_label')} {formatDaysAgo(t, daysSinceLast)}
            </span>
          )}
        </p>
      )}
    </header>
  );
}
