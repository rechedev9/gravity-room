import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/components/screen-header';
import { formatDaysAgo } from './format-days-ago';

interface HomeHeaderProps {
  readonly userName: string | null;
  readonly streakDays: number | null;
  readonly daysSinceLast: number | null;
}

/** Kicker, display greeting and one quiet line of streak context, like the mobile screens. */
export function HomeHeader({
  userName,
  streakDays,
  daysSinceLast,
}: HomeHeaderProps): React.ReactNode {
  const { t } = useTranslation();
  const parts: string[] = [];
  if (streakDays !== null && streakDays > 0) {
    parts.push(t('home.header.streak_inline', { count: streakDays }));
  }
  if (daysSinceLast !== null) {
    parts.push(`${t('home.header.last_session_label')} ${formatDaysAgo(t, daysSinceLast)}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-5 pt-6 sm:px-6 sm:pt-8">
      <ScreenHeader
        eyebrow={t('home.header.eyebrow')}
        title={
          userName
            ? t('home.header.greeting_named', { name: userName })
            : t('home.header.greeting_generic')
        }
        subtitle={parts.length > 0 ? parts.join(' · ') : undefined}
      />
    </div>
  );
}
