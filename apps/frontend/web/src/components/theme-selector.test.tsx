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
    expect(screen.getByRole('radio', { name: /^Gold\./i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Light\./i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /^Dark\./i })).toBeTruthy();

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('gold');
    });
  });

  it('applies classic-light to the document root and persists it', async () => {
    render(<ThemeSelector />);

    fireEvent.click(screen.getByRole('radio', { name: /^Light\./i }));

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('classic-light');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('classic-light');
      expect(screen.getByRole('radio', { name: /^Light\./i })).toHaveAttribute(
        'aria-checked',
        'true'
      );
    });
  });

  it('cycles gold → light → dark via arrow keys and marks the root each time', async () => {
    render(<ThemeSelector />);

    const gold = screen.getByRole('radio', { name: /^Gold\./i });
    gold.focus();
    fireEvent.keyDown(gold, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('classic-light');
    });

    const light = screen.getByRole('radio', { name: /^Light\./i });
    fireEvent.keyDown(light, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(document.documentElement.getAttribute('data-theme')).toBe('classic-dark');
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('classic-dark');
    });
  });

  it('compact mode keeps short visible labels and rich accessible names', () => {
    render(<ThemeSelector compact />);

    // Short mono labels stay visible so the three swatches are discoverable.
    expect(screen.getByText('Gold')).toBeTruthy();
    expect(screen.getByText('Light')).toBeTruthy();
    expect(screen.getByText('Dark')).toBeTruthy();
    expect(
      screen.getByRole('radio', { name: /Gold\.\s+Forged iron with gold accent/i })
    ).toBeTruthy();
  });
});
