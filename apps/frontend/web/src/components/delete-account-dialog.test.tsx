import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/lib/i18n';
import { DeleteAccountDialog } from './delete-account-dialog';

function DialogHarness(): React.ReactNode {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open deletion dialog
      </button>
      <DeleteAccountDialog open={open} onConfirm={vi.fn()} onCancel={() => setOpen(false)} />
    </>
  );
}

describe('DeleteAccountDialog', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('accepts the confirmation word shown by the active locale', async () => {
    render(<DeleteAccountDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />);

    const input = screen.getByRole('textbox', { name: 'Confirmation phrase' });
    const confirm = screen.getByRole('button', { name: 'Delete Account' });

    fireEvent.change(input, { target: { value: 'ELIMINAR' } });
    expect(confirm).toBeDisabled();

    fireEvent.change(input, { target: { value: 'delete' } });
    await waitFor(() => expect(confirm).toBeEnabled());
  });

  it('associates the input with instructions and exposes invalid feedback', async () => {
    render(<DeleteAccountDialog open onConfirm={vi.fn()} onCancel={vi.fn()} />);

    const input = screen.getByRole('textbox', { name: 'Confirmation phrase' });
    fireEvent.change(input, { target: { value: 'wrong' } });

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Incorrect');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toContain(alert.id);
  });

  it('returns focus to the opener when the dialog closes', async () => {
    render(<DialogHarness />);

    const opener = screen.getByRole('button', { name: 'Open deletion dialog' });
    opener.focus();
    fireEvent.click(opener);

    const input = await screen.findByRole('textbox', { name: 'Confirmation phrase' });
    await waitFor(() => expect(input).toHaveFocus());

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(opener).toHaveFocus());
  });
});
