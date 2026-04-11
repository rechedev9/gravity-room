import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

const LANGUAGES = [
  { code: 'es' as const, label: 'ES', name: 'Español' },
  { code: 'en' as const, label: 'EN', name: 'English' },
];

export function LanguageSelector({ className }: { readonly className?: string }): React.ReactNode {
  const { i18n } = useTranslation();
  const rawLang = i18n.language.split('-')[0];
  const currentLang: 'es' | 'en' = rawLang === 'es' ? 'es' : 'en';

  const handleChange = (lang: 'es' | 'en') => {
    void i18n.changeLanguage(lang);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-md bg-[var(--color-sidebar-active)] p-0.5',
        className
      )}
      role="radiogroup"
      aria-label="Language selector"
    >
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          type="button"
          role="radio"
          aria-checked={currentLang === lang.code}
          aria-label={lang.name}
          onClick={() => handleChange(lang.code)}
          className={cn(
            'px-2 py-1 text-[10px] font-bold rounded-sm transition-all cursor-pointer',
            currentLang === lang.code ? 'bg-accent text-white' : 'text-muted hover:text-main'
          )}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
