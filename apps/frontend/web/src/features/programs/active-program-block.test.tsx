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
import { ActiveProgramBlock } from './active-program-block';

describe('ActiveProgramBlock', () => {
  afterEach(async () => {
    cleanup();
    if (i18n.language !== 'es') {
      await act(async () => {
        await i18n.changeLanguage('es');
      });
    }
  });

  it('renders the active-program heading, name, progress and tracker CTA', () => {
    render(
      createElement(ActiveProgramBlock, {
        programId: 'gzclp',
        name: 'GZCLP',
        completed: 1,
        total: 90,
      })
    );
    expect(screen.getByText('Programa activo')).toBeInTheDocument();
    expect(screen.getByText('GZCLP')).toBeInTheDocument();
    expect(screen.getByText('Entrenamiento 1 de 90')).toBeInTheDocument();
    const cta = screen.getByText('Continuar entrenamiento').closest('a');
    expect(cta).toHaveAttribute('to', '/app/tracker');
  });

  it('omits the progress line until the total is known', () => {
    render(
      createElement(ActiveProgramBlock, {
        programId: 'gzclp',
        name: 'GZCLP',
        completed: 0,
        total: 0,
      })
    );
    expect(screen.queryByText(/Entrenamiento/)).not.toBeInTheDocument();
  });

  it('renders English copy', async () => {
    await i18n.changeLanguage('en');
    render(
      createElement(ActiveProgramBlock, {
        programId: 'gzclp',
        name: 'GZCLP',
        completed: 3,
        total: 90,
      })
    );
    expect(screen.getByText('Active program')).toBeInTheDocument();
    expect(screen.getByText('Workout 3 of 90')).toBeInTheDocument();
  });
});
