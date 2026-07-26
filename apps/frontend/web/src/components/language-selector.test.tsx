import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import i18n from '@/lib/i18n';
import { LanguageSelector } from './language-selector';

describe('LanguageSelector', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('es');
    document.documentElement.lang = 'es';
  });

  it('uses a single tab stop and arrow keys to select the next language', async () => {
    render(<LanguageSelector />);

    const spanish = screen.getByRole('radio', { name: 'Español' });
    const english = screen.getByRole('radio', { name: 'English' });

    expect(spanish).toHaveAttribute('tabindex', '0');
    expect(english).toHaveAttribute('tabindex', '-1');

    spanish.focus();
    fireEvent.keyDown(spanish, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(english).toHaveAttribute('aria-checked', 'true');
      expect(english).toHaveAttribute('tabindex', '0');
      expect(english).toHaveFocus();
      expect(document.documentElement.lang).toBe('en');
    });
  });

  it('updates the document language when a language is clicked', async () => {
    render(<LanguageSelector />);

    fireEvent.click(screen.getByRole('radio', { name: 'English' }));

    await waitFor(() => {
      expect(document.documentElement.lang).toBe('en');
    });
  });
});
