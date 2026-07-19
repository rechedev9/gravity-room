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
import { TrackerGuestEmpty } from './tracker-guest-empty';

describe('TrackerGuestEmpty', () => {
  afterEach(async () => {
    cleanup();
    if (i18n.language !== 'es') {
      await act(async () => {
        await i18n.changeLanguage('es');
      });
    }
  });

  it('points guests at the catalog instead of the home wall', () => {
    render(createElement(TrackerGuestEmpty));
    expect(screen.getByText('Elige un programa')).toBeInTheDocument();
    const cta = screen.getByText('Explorar programas').closest('a');
    expect(cta).toHaveAttribute('to', '/app/programs');
  });

  it('renders English copy', async () => {
    await i18n.changeLanguage('en');
    render(createElement(TrackerGuestEmpty));
    expect(screen.getByText('Pick a program')).toBeInTheDocument();
    expect(screen.getByText('Explore programs')).toBeInTheDocument();
  });
});
