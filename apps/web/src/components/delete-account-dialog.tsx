import { useState, useEffect, useRef } from 'react';
import { Button } from './button';

const CONFIRM_WORD = 'ELIMINAR';

interface DeleteAccountDialogProps {
  readonly open: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly loading?: boolean;
}

export function DeleteAccountDialog({
  open,
  onConfirm,
  onCancel,
  loading = false,
}: DeleteAccountDialogProps): React.ReactNode {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const isConfirmed = input.trim().toUpperCase() === CONFIRM_WORD;

  useEffect(() => {
    if (open) {
      setInput('');
      // Focus the input after a tick so the dialog is rendered
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return (): void => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, onCancel]);

  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'Tab') return;
    const focusable: HTMLElement[] = [];
    if (inputRef.current) focusable.push(inputRef.current);
    if (cancelRef.current) focusable.push(cancelRef.current);
    if (focusable.length < 2) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (first && e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (last && !e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-account-title"
        className="modal-box bg-card border border-rule p-6 max-w-sm w-[calc(100%-2rem)] shadow-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
      >
        <h3 id="delete-account-title" className="text-sm font-bold text-fail mb-2">
          Eliminar Cuenta
        </h3>

        <div className="text-xs text-muted mb-4 leading-relaxed">
          <p className="mb-2">
            Esta acción marcará tu cuenta para eliminación. Tus datos serán eliminados
            permanentemente tras 30 días.
          </p>
          <p>
            Escribe <strong className="text-main">{CONFIRM_WORD}</strong> para confirmar.
          </p>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={CONFIRM_WORD}
          className="w-full px-3 py-2 mb-4 text-xs bg-body border border-rule text-main placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          autoComplete="off"
          spellCheck={false}
          disabled={loading}
        />

        <div className="flex justify-end gap-3">
          <Button ref={cancelRef} variant="ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={!isConfirmed || loading}>
            {loading ? 'Eliminando...' : 'Eliminar Cuenta'}
          </Button>
        </div>
      </div>
    </div>
  );
}
