import { render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShortcutsOverlay } from './shortcuts-overlay';

beforeAll(() => {
  if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
  }
  if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
  }
});

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('ShortcutsOverlay', () => {
  it('gives the dialog an accessible name from its heading on fine-pointer devices', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query === '(pointer: fine)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<ShortcutsOverlay enabled />);

    const dialog = await screen.findByRole('dialog', { name: 'ATAJOS DE TECLADO' });
    const labelledBy = dialog.getAttribute('aria-labelledby');

    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy ?? '')).toHaveTextContent('ATAJOS DE TECLADO');
    expect(screen.getByTestId('shortcuts-understood')).toBeInTheDocument();
  });

  it('does not auto-open on coarse-pointer (touch) devices so set-first logging stays free', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
      matches: query === '(pointer: coarse)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<ShortcutsOverlay enabled />);

    expect(screen.queryByTestId('shortcuts-overlay')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
