import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import type { ThemeId } from '@/lib/theme-preference';
import { useThemePreference } from '@/hooks/use-theme-preference';

const THEME_META: readonly {
  readonly id: ThemeId;
  readonly labelKey: string;
  readonly hintKey: string;
  readonly swatch: string;
}[] = [
  {
    id: 'gold',
    labelKey: 'theme_selector.gold',
    hintKey: 'theme_selector.gold_hint',
    // Warm iron + gold — matches the forged-iron signature.
    swatch: 'linear-gradient(135deg, oklch(0.14 0.01 70) 45%, oklch(0.8 0.145 84) 45%)',
  },
  {
    id: 'classic-light',
    labelKey: 'theme_selector.classic_light',
    hintKey: 'theme_selector.classic_light_hint',
    // Warm paper + deep gold accent (brand-aligned).
    swatch: 'linear-gradient(135deg, oklch(0.97 0.008 85) 45%, oklch(0.55 0.14 80) 45%)',
  },
  {
    id: 'classic-dark',
    labelKey: 'theme_selector.classic_dark',
    hintKey: 'theme_selector.classic_dark_hint',
    // Neutral charcoal + forged gold accent.
    swatch: 'linear-gradient(135deg, oklch(0.16 0.008 260) 45%, oklch(0.8 0.145 84) 45%)',
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
      nextIndex = (index + 1) % THEME_META.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + THEME_META.length) % THEME_META.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = THEME_META.length - 1;
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
        const hint = t(item.hintKey);
        // Compact sidebar still shows a short mono label so the three swatches
        // are discoverable without hovering (aria-label alone is not enough).
        return (
          <button
            key={item.id}
            ref={(el) => {
              buttonRefs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${label}. ${hint}`}
            title={`${label} — ${hint}`}
            tabIndex={selected ? 0 : -1}
            data-theme-option={item.id}
            onClick={() => setTheme(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              'flex items-center justify-center gap-1.5 min-h-11 rounded-sm transition-all cursor-pointer',
              compact ? 'min-w-11 px-1.5 flex-col py-1' : 'min-w-11 px-2.5 py-1',
              selected
                ? 'bg-accent text-on-accent ring-1 ring-accent'
                : 'text-muted hover:text-main hover:bg-[var(--color-surface-2)]'
            )}
          >
            <span
              aria-hidden
              className="block h-3.5 w-3.5 shrink-0 rounded-full border border-rule-light"
              style={{ background: item.swatch }}
            />
            <span
              className={cn(
                'font-mono font-bold uppercase tracking-[0.05em]',
                compact ? 'text-[9px] leading-none' : 'text-[10px]'
              )}
            >
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
