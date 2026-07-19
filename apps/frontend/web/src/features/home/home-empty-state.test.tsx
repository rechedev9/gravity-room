import { describe, it, expect, afterEach, vi } from 'vitest';
import i18n from 'i18next';
import { createElement } from 'react';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    ...rest
  }: {
    readonly children: React.ReactNode;
    readonly [k: string]: unknown;
  }) => createElement('a', rest as Record<string, unknown>, children),
}));

import { render, screen, act, cleanup } from '@testing-library/react';
import { HomeEmptyState } from './home-empty-state';

describe('HomeEmptyState i18n', () => {
  afterEach(async () => {
    cleanup();
    if (i18n.language !== 'es') {
      await act(async () => {
        await i18n.changeLanguage('es');
      });
    }
  });

  it('guest variant showcases exploration links instead of an account wall', () => {
    render(createElement(HomeEmptyState, { variant: 'guest' }));
    expect(screen.getByText('INVITADO')).toBeInTheDocument();
    expect(screen.getByText('Pruébalo sin cuenta')).toBeInTheDocument();
    // Primary CTA points at the catalog (guests can start + track locally),
    // not at /login.
    const programsLink = screen.getByText('Explorar programas').closest('a');
    expect(programsLink).toHaveAttribute('to', '/app/programs');
    expect(screen.getByText('Guía de ejercicios')).toBeInTheDocument();
    expect(screen.queryByText('Crear Cuenta')).not.toBeInTheDocument();
  });

  it('guest variant renders English copy and links to the in-app exercise wiki', async () => {
    await i18n.changeLanguage('en');
    render(createElement(HomeEmptyState, { variant: 'guest' }));
    expect(screen.getByText('GUEST')).toBeInTheDocument();
    expect(screen.getByText('Try it without an account')).toBeInTheDocument();
    expect(screen.getByText('Explore programs')).toBeInTheDocument();
    // The in-app wiki route resolves language from the active locale, so a
    // single non-localized URL is used for both languages.
    const wikiLink = screen.getByText('Exercise guide').closest('a');
    expect(wikiLink).toHaveAttribute('to', '/app/exercises');
  });

  it('no-program variant renders Spanish copy', () => {
    render(createElement(HomeEmptyState, { variant: 'no-program' }));
    expect(screen.getByText('SIN PROGRAMA')).toBeInTheDocument();
    expect(screen.getByText('Sin programa activo')).toBeInTheDocument();
    expect(screen.getByText('Ver Programas')).toBeInTheDocument();
  });

  it('no-program variant renders English copy', async () => {
    await i18n.changeLanguage('en');
    render(createElement(HomeEmptyState, { variant: 'no-program' }));
    expect(screen.getByText('NO PROGRAM')).toBeInTheDocument();
    expect(screen.getByText('No active program')).toBeInTheDocument();
    expect(screen.getByText('View Programs')).toBeInTheDocument();
  });
});
