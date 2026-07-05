import { describe, it, expect, afterEach, vi } from 'vitest';
import i18n from 'i18next';
import { createElement } from 'react';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
  }: {
    readonly children: React.ReactNode;
    readonly to: string;
    readonly params?: Record<string, string>;
  }) => createElement('a', { href: to, 'data-params': JSON.stringify(params ?? {}) }, children),
}));

import { render, screen, act, cleanup } from '@testing-library/react';
import { HomeGuestResume } from './home-guest-resume';

describe('HomeGuestResume', () => {
  afterEach(async () => {
    cleanup();
    if (i18n.language !== 'es') {
      await act(async () => {
        await i18n.changeLanguage('es');
      });
    }
  });

  it('renders the program name and Spanish resume copy', () => {
    render(createElement(HomeGuestResume, { programId: 'gzclp', programName: 'GZCLP' }));
    expect(screen.getByText('EN PROGRESO')).toBeInTheDocument();
    expect(screen.getByText('GZCLP')).toBeInTheDocument();
    expect(screen.getByText('Continuar entrenamiento')).toBeInTheDocument();
  });

  it('renders English resume copy', async () => {
    await i18n.changeLanguage('en');
    render(createElement(HomeGuestResume, { programId: 'gzclp', programName: 'GZCLP' }));
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
    expect(screen.getByText('Continue training')).toBeInTheDocument();
  });

  it('links to the tracker route for the given program', () => {
    render(createElement(HomeGuestResume, { programId: 'gzclp', programName: 'GZCLP' }));
    const link = screen.getByRole('link');
    // The mocked Link exposes `to` as href and serializes `params`.
    expect(link.getAttribute('href')).toBe('/app/tracker/$programId');
    expect(link.getAttribute('data-params')).toBe(JSON.stringify({ programId: 'gzclp' }));
  });
});
