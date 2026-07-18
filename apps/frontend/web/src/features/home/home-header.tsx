import { useTranslation } from 'react-i18next';

interface HomeHeaderProps {
  readonly userName: string | null;
}

export function HomeHeader({ userName }: HomeHeaderProps): React.ReactNode {
  const { t } = useTranslation();

  return (
    <header>
      <p className="mb-1 font-mono text-[10px] font-semibold tracking-[0.2em] text-label uppercase">
        {t('home.header.command_center')}
      </p>
      <h1 className="font-display text-3xl tracking-wide text-title sm:text-4xl">
        {userName
          ? t('home.header.greeting_named', { name: userName })
          : t('home.header.greeting_generic')}
      </h1>
      <p className="mt-1 text-sm text-muted">{t('home.header.next_ready')}</p>
    </header>
  );
}
