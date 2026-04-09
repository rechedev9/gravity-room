import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { Button } from './button';

const CONFIRM_WORD = 'ELIMINAR';

const DeleteAccountFormSchema = z.object({
  input: z.string().refine((v) => v.trim().toUpperCase() === CONFIRM_WORD, 'Incorrecto'),
});

type DeleteAccountFormValues = z.infer<typeof DeleteAccountFormSchema>;

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
  const dialogDivRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const {
    register,
    formState: { isValid },
    reset,
  } = useForm<DeleteAccountFormValues>({
    resolver: zodResolver(DeleteAccountFormSchema),
    defaultValues: { input: '' },
    mode: 'onChange',
  });

  // Reset and focus input when dialog opens (legitimate imperative DOM focus call)
  useEffect(() => {
    if (open) {
      reset({ input: '' });
      requestAnimationFrame(() => {
        const input = dialogDivRef.current?.querySelector<HTMLInputElement>('input');
        input?.focus();
      });
    }
  }, [open, reset]);

  // Escape key handling
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
    const focusable = Array.from(
      dialogDivRef.current?.querySelectorAll<HTMLElement>('input, button') ?? []
    );
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
        ref={dialogDivRef}
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
          {...register('input')}
          type="text"
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
          <Button variant="danger" onClick={onConfirm} disabled={!isValid || loading}>
            {loading ? 'Eliminando...' : 'Eliminar Cuenta'}
          </Button>
        </div>
      </div>
    </div>
  );
}
