import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { ShortcutsOverlay } from './shortcuts-overlay';

beforeAll(() => {
  if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
  }
});

describe('ShortcutsOverlay', () => {
  it('gives the dialog an accessible name from its heading', async () => {
    render(<ShortcutsOverlay enabled />);

    const dialog = await screen.findByRole('dialog', { name: 'ATAJOS DE TECLADO' });
    const labelledBy = dialog.getAttribute('aria-labelledby');

    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy ?? '')).toHaveTextContent('ATAJOS DE TECLADO');
  });
});
