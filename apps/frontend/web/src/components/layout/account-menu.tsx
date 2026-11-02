import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { UserInfo } from '@gzclp/domain/schemas/user';
import { useClickOutside } from '@/hooks/use-click-outside';
import { useThemePreference } from '@/hooks/use-theme-preference';
import { useUnitPreference } from '@/hooks/use-unit-preference';
import { ensureLocale } from '@/lib/i18n';
import { cn } from '@/lib/cn';

const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--color-sidebar)]';

const LANGUAGE_NAMES = { es: 'Español', en: 'English' } as const;

interface AccountMenuProps {
  readonly user: UserInfo;
  readonly onSignOut: () => void;
}

/** Up to two initials from the name, else the first letter of the email. */
function initialsOf(user: UserInfo): string {
  const words = (user.name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    return words
      .slice(0, 2)
      .map((word) => word[0] ?? '')
      .join('')
      .toUpperCase();
  }
  return (user.email[0] ?? 'U').toUpperCase();
}

/**
 * Desktop sidebar account row: avatar, name and "Cuenta". It opens the account
 * menu upwards with Perfil, Unidades, Idioma, Tema and Cerrar sesión. The three
 * preference rows switch their value in place and keep the menu open, so the
 * new value is visible next to its label.
 */
export function AccountMenu({ user, onSignOut }: AccountMenuProps): React.ReactNode {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { unit, toggleUnit } = useUnitPreference();
  const { theme, setTheme } = useThemePreference();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const language: 'es' | 'en' = i18n.language.split('-')[0] === 'en' ? 'en' : 'es';
  const displayName = user.name?.trim() ? user.name.trim() : user.email;

  const close = useCallback((): void => {
    setOpen(false);
  }, []);

  // The trigger lives inside rootRef, so pressing it never counts as outside.
  useClickOutside(rootRef, close);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []
    );
    if (items.length === 0) return;
    const current = items.findIndex((item) => item === document.activeElement);
    let next: number | undefined;
    if (event.key === 'ArrowDown') next = (current + 1) % items.length;
    else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = items.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    items[next]?.focus();
  };

  const switchLanguage = async (): Promise<void> => {
    const nextLanguage = language === 'es' ? 'en' : 'es';
    // The second locale is its own chunk: load it first so labels never flash keys.
    await ensureLocale(nextLanguage);
    await i18n.changeLanguage(nextLanguage);
    document.documentElement.lang = nextLanguage;
  };

  const themeLabel =
    theme === 'gold' ? t('theme_selector.gold') : t('theme_selector.classic_light');

  return (
    <div ref={rootRef} className="relative">
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={t('desktop_shell.account.menu_label')}
          onKeyDown={handleMenuKeyDown}
          className="absolute bottom-full left-2 right-2 z-40 mb-1 rounded-control border border-rule-light bg-card p-1.5 shadow-elevated"
        >
          <MenuItem
            item="profile"
            onSelect={() => {
              close();
              void navigate({ to: '/app/profile' });
            }}
          >
            {t('desktop_shell.account.profile')}
          </MenuItem>
          <MenuItem item="units" value={unit} onSelect={toggleUnit}>
            {t('desktop_shell.account.units')}
          </MenuItem>
          <MenuItem
            item="language"
            value={LANGUAGE_NAMES[language]}
            onSelect={() => void switchLanguage()}
          >
            {t('desktop_shell.account.language')}
          </MenuItem>
          <MenuItem
            item="theme"
            value={themeLabel}
            onSelect={() => setTheme(theme === 'gold' ? 'classic-light' : 'gold')}
          >
            {t('desktop_shell.account.theme')}
          </MenuItem>
          <div role="separator" className="mx-0.5 my-1 h-px bg-rule" />
          <MenuItem
            item="sign-out"
            onSelect={() => {
              close();
              onSignOut();
            }}
          >
            {t('desktop_shell.account.sign_out')}
          </MenuItem>
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={t('desktop_shell.account.trigger_label', { name: displayName })}
        className={cn(
          'flex w-full min-h-11 items-center gap-2.5 rounded-control p-2 text-left transition-colors duration-[var(--duration-instant)] hover:bg-[var(--color-surface-2)] cursor-pointer',
          FOCUS_RING
        )}
      >
        <span
          aria-hidden="true"
          className="flex size-[30px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-accent-dim)] font-mono text-[13px] font-bold text-accent"
        >
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="size-full object-cover" />
          ) : (
            initialsOf(user)
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-main" title={displayName}>
            {displayName}
          </span>
          <span className="block text-[11px] text-label">{t('desktop_shell.account.role')}</span>
        </span>
        <span aria-hidden="true" className="text-xs text-label">
          ⌄
        </span>
      </button>
    </div>
  );
}

interface MenuItemProps {
  readonly item: string;
  readonly value?: string;
  readonly onSelect: () => void;
  readonly children: React.ReactNode;
}

function MenuItem({ item, value, onSelect, children }: MenuItemProps): React.ReactNode {
  return (
    <button
      type="button"
      role="menuitem"
      data-item={item}
      onClick={onSelect}
      className="flex w-full min-h-9 items-center justify-between gap-3 rounded-[8px] px-2.5 py-2 text-left text-[13px] text-muted transition-colors hover:bg-[var(--color-surface-2)] hover:text-main focus-visible:bg-[var(--color-surface-2)] focus-visible:text-main focus-visible:outline-none cursor-pointer"
    >
      <span>{children}</span>
      {value !== undefined && <span className="font-mono text-[11px] text-label">{value}</span>}
    </button>
  );
}
