import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { THEME_STORAGE_KEY } from '@/lib/theme-preference';
import { ThemeSelector } from './theme-selector';

describe('ThemeSelector', () => {
  beforeEach(async () => {
    try {
      localStorage.clear();
    } catch {
      /* Node experimental localStorage may lack clear() */
    }
    document.documentElement.removeAttribute('data-theme');
    await i18n.changeLanguage('en');
  });

  it('renders three theme options and defaults the root to gold after mount', async () => {
    render(<ThemeSelector />);

    expect(screen.getByRole('radiogroup', { name: 'Theme' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Gold' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Light' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeTruthy();

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('gold');
    });
  });

  it('applies classic-light to the document root and persists it', async () => {
    render(<ThemeSelector />);

    fireEvent.click(screen.getByRole('radio', { name: 'Light' }));

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('classic-light');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('classic-light');
      expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
    });
  });

  it('cycles gold → light → dark via arrow keys and marks the root each time', async () => {
    render(<ThemeSelector />);

    const gold = screen.getByRole('radio', { name: 'Gold' });
    gold.focus();
    fireEvent.keyDown(gold, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('classic-light');
    });

    const light = screen.getByRole('radio', { name: 'Light' });
    fireEvent.keyDown(light, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('classic-dark');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('classic-dark');
    });
  });

  it('compact mode hides text labels but keeps accessible names', () => {
    render(<ThemeSelector compact />);

    expect(screen.getByRole('radio', { name: 'Gold' })).toBeTruthy();
    // Visible label text is omitted in compact mode
    expect(screen.queryByText('Gold')).toBeNull();
  });
});
