import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CookieBanner } from './cookie-banner';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

describe('CookieBanner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('persists a dismissal when local storage is available', async () => {
    render(<CookieBanner />);
    const accept = await screen.findByRole('button');

    fireEvent.click(accept);

    expect(localStorage.getItem('cookie-banner-dismissed')).toBe('1');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('remains usable when browser privacy settings block local storage', async () => {
    const getItemSpy = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage is disabled', 'SecurityError');
    });
    const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage is disabled', 'SecurityError');
    });

    render(<CookieBanner />);
    const accept = await screen.findByRole('button');

    fireEvent.click(accept);

    await waitFor(() => {
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    // i18next persists its test-language reset after this test completes.
    getItemSpy.mockRestore();
    setItemSpy.mockRestore();
  });
});
