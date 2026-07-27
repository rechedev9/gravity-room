import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

const LANGUAGES = [
  { code: 'es' as const, label: 'ES', name: 'Español' },
  { code: 'en' as const, label: 'EN', name: 'English' },
];

export function LanguageSelector({ className }: { readonly className?: string }): React.ReactNode {
  const { i18n, t } = useTranslation();
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const rawLang = i18n.language.split('-')[0];
  const currentLang: 'es' | 'en' = rawLang === 'es' ? 'es' : 'en';

  const handleChange = async (lang: 'es' | 'en'): Promise<void> => {
    await i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number): void => {
    let nextIndex: number | undefined;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % LANGUAGES.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + LANGUAGES.length) % LANGUAGES.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = LANGUAGES.length - 1;
    }

    if (nextIndex === undefined) return;

    event.preventDefault();
    const nextLanguage = LANGUAGES[nextIndex];
    if (nextLanguage === undefined) return;
    buttonRefs.current[nextIndex]?.focus();
    void handleChange(nextLanguage.code);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-md bg-[var(--color-card,var(--color-sidebar-active))] border border-rule p-0.5',
        className
      )}
      role="radiogroup"
      aria-label={t('language_selector.aria_label')}
    >
      {LANGUAGES.map((lang, index) => (
        <button
          key={lang.code}
          ref={(element) => {
            buttonRefs.current[index] = element;
          }}
          type="button"
          role="radio"
          aria-checked={currentLang === lang.code}
          aria-label={lang.name}
          tabIndex={currentLang === lang.code ? 0 : -1}
          onClick={() => void handleChange(lang.code)}
          onKeyDown={(event) => handleKeyDown(event, index)}
          className={cn(
            'min-h-11 min-w-11 px-2 py-1 text-[10px] font-bold rounded-sm transition-all cursor-pointer',
            currentLang === lang.code ? 'bg-accent text-on-accent' : 'text-muted hover:text-main'
          )}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
