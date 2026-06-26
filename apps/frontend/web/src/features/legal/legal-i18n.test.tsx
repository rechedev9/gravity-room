import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import i18n from '@/lib/i18n';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    ...rest
  }: {
    readonly children: ReactNode;
    readonly [key: string]: unknown;
  }) => createElement('a', rest, children),
}));

import { CookiePolicyPage } from './cookie-policy-page';
import { PrivacyPage } from './privacy-page';

describe('legal pages i18n', () => {
  it('renders the cookie policy in English when English is active', async () => {
    await i18n.changeLanguage('en');

    render(createElement(CookiePolicyPage));

    expect(screen.getByRole('heading', { name: 'Cookie Policy' })).toBeDefined();
    expect(screen.getByText('What are cookies?')).toBeDefined();
    expect(screen.queryByText('¿Qué son las cookies?')).toBeNull();
  });

  it('renders the privacy policy in English when English is active', async () => {
    await i18n.changeLanguage('en');

    render(createElement(PrivacyPage));

    expect(screen.getByRole('heading', { name: 'Privacy Policy' })).toBeDefined();
    expect(screen.getByText('Data We Store')).toBeDefined();
    expect(screen.queryByText('Política de Privacidad')).toBeNull();
  });
});
