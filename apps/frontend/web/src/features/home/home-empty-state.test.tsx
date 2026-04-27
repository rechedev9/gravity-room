import { describe, it, expect, afterEach, mock } from 'bun:test';
import i18n from 'i18next';
import { createElement } from 'react';

mock.module('@tanstack/react-router', () => ({
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

  it('guest variant renders Spanish copy', () => {
    render(createElement(HomeEmptyState, { variant: 'guest' }));
    expect(screen.getByText('Modo invitado')).toBeInTheDocument();
    expect(screen.getByText('Crear Cuenta')).toBeInTheDocument();
  });

  it('guest variant renders English copy', async () => {
    await i18n.changeLanguage('en');
    render(createElement(HomeEmptyState, { variant: 'guest' }));
    expect(screen.getByText('Guest mode')).toBeInTheDocument();
    expect(screen.getByText('Create Account')).toBeInTheDocument();
  });

  it('no-program variant renders Spanish copy', () => {
    render(createElement(HomeEmptyState, { variant: 'no-program' }));
    expect(screen.getByText('Sin programa activo')).toBeInTheDocument();
    expect(screen.getByText('Ver Programas')).toBeInTheDocument();
  });

  it('no-program variant renders English copy', async () => {
    await i18n.changeLanguage('en');
    render(createElement(HomeEmptyState, { variant: 'no-program' }));
    expect(screen.getByText('No active program')).toBeInTheDocument();
    expect(screen.getByText('View Programs')).toBeInTheDocument();
  });
});
