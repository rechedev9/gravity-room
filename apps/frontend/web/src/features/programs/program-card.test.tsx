import { describe, it, expect, afterEach, mock } from 'bun:test';
import i18n from 'i18next';
import { createElement } from 'react';

mock.module('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    ...rest
  }: {
    readonly children: React.ReactNode;
    readonly to: string;
    readonly [k: string]: unknown;
  }) => createElement('a', { ...rest, href: to } as Record<string, unknown>, children),
}));

import { render, screen, act, cleanup, fireEvent } from '@testing-library/react';
import { ProgramCard, type ProgramCardInfo } from './program-card';

const FIXTURE: ProgramCardInfo = {
  id: 'gzclp',
  name: 'GZCLP',
  description: 'Linear progression program',
  category: 'strength',
  totalWorkouts: 200,
  workoutsPerWeek: 4,
  author: 'Cody LeFever',
};

describe('ProgramCard', () => {
  afterEach(async () => {
    cleanup();
    if (i18n.language !== 'es') {
      await act(async () => {
        await i18n.changeLanguage('es');
      });
    }
  });

  it('renders preview link and start button when previewTo + onSelect are both provided', () => {
    const onSelect = mock();
    render(
      createElement(ProgramCard, {
        definition: FIXTURE,
        previewTo: '/programs/gzclp',
        onSelect,
      })
    );

    const previewLink = screen.getByRole('link', { name: /ver programa gzclp/i });
    expect(previewLink).toBeInTheDocument();
    expect(previewLink.getAttribute('href')).toBe('/programs/gzclp');
    expect(previewLink.textContent).toContain('Vista Previa');

    const startBtn = screen.getByRole('button', { name: 'Iniciar Programa' });
    expect(startBtn).toBeInTheDocument();
    fireEvent.click(startBtn);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('renders only a single start button when only onSelect is provided', () => {
    const onSelect = mock();
    render(
      createElement(ProgramCard, {
        definition: FIXTURE,
        onSelect,
      })
    );

    expect(screen.getByRole('button', { name: 'Iniciar Programa' })).toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders only a single link when only `to` is provided (legacy single-action path)', () => {
    render(
      createElement(ProgramCard, {
        definition: FIXTURE,
        to: '/some/path',
      })
    );

    const link = screen.getByRole('link', { name: /ver programa gzclp/i });
    expect(link).toBeInTheDocument();
    expect(link.getAttribute('href')).toBe('/some/path');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders English copy when locale is en', async () => {
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    const onSelect = mock();
    render(
      createElement(ProgramCard, {
        definition: FIXTURE,
        previewTo: '/programs/gzclp',
        onSelect,
      })
    );

    expect(screen.getByRole('link', { name: /view gzclp/i })).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Program' })).toBeInTheDocument();
  });
});
