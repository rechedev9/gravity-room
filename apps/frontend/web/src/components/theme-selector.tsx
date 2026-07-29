import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { THEME_IDS, type ThemeId } from '@/lib/theme-preference';
import { useThemePreference } from '@/hooks/use-theme-preference';

const THEME_META: readonly {
  readonly id: ThemeId;
  readonly labelKey: string;
  readonly swatch: string;
}[] = [
  {
    id: 'gold',
    labelKey: 'theme_selector.gold',
    // Warm iron + gold — matches the forged-iron signature.
    swatch: 'linear-gradient(135deg, oklch(0.14 0.01 70) 45%, oklch(0.8 0.145 84) 45%)',
  },
  {
    id: 'classic-light',
    labelKey: 'theme_selector.classic_light',
    swatch: 'linear-gradient(135deg, oklch(0.97 0.004 250) 45%, oklch(0.48 0.16 265) 45%)',
  },
  {
    id: 'classic-dark',
    labelKey: 'theme_selector.classic_dark',
    swatch: 'linear-gradient(135deg, oklch(0.16 0.008 260) 45%, oklch(0.72 0.12 270) 45%)',
  },
];

interface ThemeSelectorProps {
  readonly className?: string;
  /** Compact swatch-only mode for tight chrome (sidebar footer). */
  readonly compact?: boolean;
}

/**
 * Segmented theme control — gold / classic light / classic dark.
 * Pattern mirrors LanguageSelector (radiogroup + arrow keys).
 */
export function ThemeSelector({ className, compact = false }: ThemeSelectorProps): React.ReactNode {
  const { t } = useTranslation();
  const { theme, setTheme } = useThemePreference();
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number): void => {
    let nextIndex: number | undefined;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % THEME_IDS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + THEME_IDS.length) % THEME_IDS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = THEME_IDS.length - 1;
    }

    if (nextIndex === undefined) return;

    event.preventDefault();
    const next = THEME_META[nextIndex];
    if (next === undefined) return;
    buttonRefs.current[nextIndex]?.focus();
    setTheme(next.id);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1 rounded-md bg-[var(--color-card,var(--color-sidebar-active))] border border-rule p-0.5',
        className
      )}
      role="radiogroup"
      aria-label={t('theme_selector.aria_label')}
      data-testid="theme-selector"
    >
      {THEME_META.map((item, index) => {
        const selected = theme === item.id;
        const label = t(item.labelKey);
        return (
          <button
            key={item.id}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            tabIndex={selected ? 0 : -1}
            data-theme-option={item.id}
            onClick={() => setTheme(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'flex items-center justify-center gap-1.5 min-h-11 min-w-11 rounded-sm transition-all cursor-pointer',
              compact ? 'px-2' : 'px-2.5 py-1',
              selected
                ? 'bg-accent text-on-accent ring-1 ring-accent'
                : 'text-muted hover:text-main hover:bg-[var(--color-surface-2)]'
            )}
          >
            <span
              aria-hidden
              className={cn(
                'block shrink-0 rounded-full border border-rule-light',
                compact ? 'h-3.5 w-3.5' : 'h-3.5 w-3.5'
              )}
              style={{ background: item.swatch }}
            />
            {compact ? null : (
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.05em]">
                {label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
