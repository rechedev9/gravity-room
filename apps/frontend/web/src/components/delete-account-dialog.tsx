import { useEffect, useId, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { Button } from './button';

const DeleteAccountDialogSchema = (t: (key: string) => string, confirmWord: string) =>
  z.object({
    input: z
      .string()
      .refine(
        (v) => v.trim().toUpperCase() === confirmWord.toUpperCase(),
        t('delete_account.validation.incorrect')
      ),
  });

type DeleteAccountFormValues = z.infer<ReturnType<typeof DeleteAccountDialogSchema>>;

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
  const { t } = useTranslation();
  const dialogDivRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const inputId = useId();
  const errorId = useId();
  const confirmWord = t('delete_account.confirm_word');

  const schema = DeleteAccountDialogSchema(t, confirmWord);
  const {
    register,
    formState: { errors, isDirty, isValid },
    reset,
  } = useForm<DeleteAccountFormValues>({
    resolver: zodResolver(schema),
    defaultValues: { input: '' },
    mode: 'onChange',
  });

  // Reset and focus input when dialog opens (legitimate imperative DOM focus call)
  useEffect(() => {
    if (!open) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    reset({ input: '' });
    const frameId = requestAnimationFrame(() => {
      const input = dialogDivRef.current?.querySelector<HTMLInputElement>('input');
      input?.focus();
    });

    return (): void => {
      cancelAnimationFrame(frameId);
      const previouslyFocused = previouslyFocusedRef.current;
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
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

  const showError = isDirty && errors.input !== undefined;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        ref={dialogDivRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="modal-box bg-card border border-rule p-6 max-w-sm w-[calc(100%-2rem)] shadow-dialog"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
      >
        <h3 id={titleId} className="text-sm font-bold text-fail mb-2">
          {t('delete_account.title')}
        </h3>

        <div id={descriptionId} className="text-xs text-muted mb-4 leading-relaxed">
          <p className="mb-2">{t('delete_account.description')}</p>
          <p>{t('delete_account.confirm_instruction', { word: confirmWord })}</p>
        </div>

        <label htmlFor={inputId} className="sr-only">
          {t('delete_account.input_label')}
        </label>
        <input
          {...register('input')}
          id={inputId}
          type="text"
          placeholder={confirmWord}
          aria-invalid={showError}
          aria-describedby={showError ? `${descriptionId} ${errorId}` : descriptionId}
          className="w-full px-3 py-2 text-xs bg-body border border-rule text-main placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          autoComplete="off"
          spellCheck={false}
          disabled={loading}
        />
        <p
          id={errorId}
          role={showError ? 'alert' : undefined}
          className="min-h-4 mt-1 mb-3 text-xs text-fail"
        >
          {showError ? errors.input?.message : ''}
        </p>

        <div className="flex justify-end gap-3">
          <Button ref={cancelRef} variant="ghost" onClick={onCancel} disabled={loading}>
            {t('delete_account.cancel')}
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={!isValid || loading}>
            {loading ? t('delete_account.loading') : t('delete_account.confirm_button')}
          </Button>
        </div>
      </div>
    </div>
  );
}
