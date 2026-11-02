import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { UserInfo } from '@gzclp/domain/schemas/user';
import i18n from '@/lib/i18n';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigate,
}));

import { AccountMenu } from './account-menu';

const USER: UserInfo = { id: 'u1', email: 'martin@example.com', name: 'Martín Rojas' };

function openMenu(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: /cuenta/i }));
  return screen.getByRole('menu', { name: 'Cuenta' });
}

afterEach(async () => {
  navigate.mockReset();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  await act(async () => {
    await i18n.changeLanguage('es');
  });
});

describe('AccountMenu', () => {
  it('shows the name and the "Cuenta" role on a closed trigger', () => {
    render(<AccountMenu user={USER} onSignOut={vi.fn()} />);
    const trigger = screen.getByRole('button', { name: /cuenta/i });
    expect(trigger.textContent).toContain('Martín Rojas');
    expect(trigger.textContent).toContain('MR');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('falls back to the email when the account has no name', () => {
    render(<AccountMenu user={{ id: 'u2', email: 'ana@example.com' }} onSignOut={vi.fn()} />);
    expect(screen.getByRole('button', { name: /cuenta/i }).textContent).toContain(
      'ana@example.com'
    );
  });

  it('lists Perfil, Unidades, Idioma, Tema and Cerrar sesión with their current values', () => {
    render(<AccountMenu user={USER} onSignOut={vi.fn()} />);
    const menu = openMenu();
    const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
    expect(items.map((item) => item.getAttribute('data-item'))).toEqual([
      'profile',
      'units',
      'language',
      'theme',
      'sign-out',
    ]);
    expect(items.map((item) => item.textContent)).toEqual([
      'Perfil',
      'Unidadeskg',
      'IdiomaEspañol',
      'TemaOro',
      'Cerrar sesión',
    ]);
    expect(screen.getByRole('button', { name: /cuenta/i }).getAttribute('aria-expanded')).toBe(
      'true'
    );
  });

  it('moves focus into the menu and through it with the arrow keys', () => {
    render(<AccountMenu user={USER} onSignOut={vi.fn()} />);
    const menu = openMenu();
    const items = Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]'));
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[4]);
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(items[4]);
  });

  it('closes on Escape and returns focus to the trigger', () => {
    render(<AccountMenu user={USER} onSignOut={vi.fn()} />);
    openMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /cuenta/i }));
  });

  it('closes on a click outside and toggles closed from the trigger', () => {
    render(
      <div>
        <p>outside</p>
        <AccountMenu user={USER} onSignOut={vi.fn()} />
      </div>
    );
    openMenu();
    fireEvent.mouseDown(screen.getByText('outside'));
    expect(screen.queryByRole('menu')).toBeNull();

    openMenu();
    const trigger = screen.getByRole('button', { name: /cuenta/i });
    fireEvent.mouseDown(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens the profile and closes the menu', () => {
    render(<AccountMenu user={USER} onSignOut={vi.fn()} />);
    fireEvent.click(within(openMenu(), 'profile'));
    expect(navigate).toHaveBeenCalledWith({ to: '/app/profile' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('toggles the unit in place and keeps the menu open', () => {
    render(<AccountMenu user={USER} onSignOut={vi.fn()} />);
    const menu = openMenu();
    fireEvent.click(within(menu, 'units'));
    expect(within(menu, 'units').textContent).toBe('Unidadeslbs');
    expect(screen.getByRole('menu', { name: 'Cuenta' })).toBe(menu);
    fireEvent.click(within(menu, 'units'));
    expect(within(menu, 'units').textContent).toBe('Unidadeskg');
  });

  it('switches the language between Español and English', async () => {
    render(<AccountMenu user={USER} onSignOut={vi.fn()} />);
    const menu = openMenu();
    await act(async () => {
      fireEvent.click(within(menu, 'language'));
    });
    expect(i18n.language).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(within(menu, 'language').textContent).toBe('LanguageEnglish');
  });

  it('switches the theme between Oro and Claro', () => {
    render(<AccountMenu user={USER} onSignOut={vi.fn()} />);
    const menu = openMenu();
    fireEvent.click(within(menu, 'theme'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('classic-light');
    expect(within(menu, 'theme').textContent).toBe('TemaClaro');
    fireEvent.click(within(menu, 'theme'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('gold');
  });

  it('signs out and closes the menu', () => {
    const onSignOut = vi.fn();
    render(<AccountMenu user={USER} onSignOut={onSignOut} />);
    fireEvent.click(within(openMenu(), 'sign-out'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

function within(menu: HTMLElement, item: string): HTMLElement {
  const el = menu.querySelector<HTMLElement>(`[data-item="${item}"]`);
  if (!el) throw new Error(`menu item ${item} not found`);
  return el;
}
