import { useEffect, useId, useRef } from 'react';
import { Button } from './button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.ReactNode {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Sync open prop with native dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  // Native cancel event (fires on Escape) → call onCancel
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event): void => {
      e.preventDefault();
      onCancel();
    };
    dialog.addEventListener('cancel', handleCancel);
    return (): void => {
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, [onCancel]);

  // Backdrop click: click on <dialog> itself (not children) closes it
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>): void => {
    if (e.target === dialogRef.current) {
      onCancel();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="modal-box bg-card border border-rule p-6 max-w-sm w-[calc(100%-2rem)] shadow-dialog backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <h3 id={titleId} className="text-sm font-bold text-heading mb-2">
        {title}
      </h3>
      <div className="text-xs text-muted leading-relaxed">{message}</div>
      <div className="border-t border-rule pt-4 mt-5 flex justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={onConfirm} disabled={loading}>
          {loading ? 'Procesando…' : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
