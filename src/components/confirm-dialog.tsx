'use client';

import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps): React.ReactNode {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      cancelRef.current?.focus();
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

  if (!open) return null;

  const dangerBtn =
    'px-4 py-2.5 min-h-[44px] text-xs font-bold cursor-pointer border-2 border-[var(--border-badge-no)] bg-[var(--bg-badge-no)] text-[var(--text-badge-no)] hover:bg-[var(--text-badge-no)] hover:text-[var(--bg-body)] transition-all';
  const defaultBtn =
    'px-4 py-2.5 min-h-[44px] text-xs font-bold cursor-pointer border-2 border-[var(--btn-border)] bg-[var(--btn-bg)] text-[var(--btn-text)] hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)] transition-all';
  const cancelBtnClass =
    'px-4 py-2.5 min-h-[44px] text-xs font-bold cursor-pointer border-2 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:bg-[var(--bg-hover-row)] hover:text-[var(--text-main)] transition-all';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        className="bg-[var(--bg-card)] border border-[var(--border-color)] p-6 max-w-sm w-[calc(100%-2rem)] shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold text-[var(--text-header)] mb-2">{title}</h3>
        <p className="text-xs text-[var(--text-muted)] mb-5 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <button ref={cancelRef} className={cancelBtnClass} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            className={variant === 'danger' ? dangerBtn : defaultBtn}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
