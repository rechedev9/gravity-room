import { useEffect, useId, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/button';

const MIN_WEIGHT = 20;
const MAX_WEIGHT = 500;
const WEIGHT_STEP = 2.5;

interface TestWeightFormValues {
  weight: string;
}

interface TestWeightModalProps {
  /** Controls modal visibility. */
  readonly isOpen: boolean;
  /** Human-readable name of the exercise being tested (e.g., "Sentadilla"). */
  readonly liftName: string;
  /** True for B1/B2 slots (propagates to next block), false for B3. */
  readonly hasPropagationTarget: boolean;
  /** Pre-fill value for the weight input (current block TM). */
  readonly defaultWeight: number;
  /** Whether the confirm action is in progress (disables buttons). */
  readonly loading?: boolean;
  /** Called when user confirms with the entered weight. */
  readonly onConfirm: (weight: number) => void;
  /** Called when user cancels (slot stays pending). */
  readonly onCancel: () => void;
}

export function TestWeightModal({
  isOpen,
  liftName,
  hasPropagationTarget,
  defaultWeight,
  loading = false,
  onConfirm,
  onCancel,
}: TestWeightModalProps): React.ReactNode {
  const { t } = useTranslation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const { register, watch, reset } = useForm<TestWeightFormValues>({
    defaultValues: { weight: String(defaultWeight) },
  });

  // Watch the current weight value to derive validity synchronously.
  // formState.isValid lags React re-renders and can't be relied on in tests
  // that call fireEvent.change + fireEvent.click without awaiting.
  const watchedWeight = watch('weight', String(defaultWeight));
  const parsedWeight = parseFloat(watchedWeight);
  const isWeightValid =
    Number.isFinite(parsedWeight) && parsedWeight >= MIN_WEIGHT && parsedWeight <= MAX_WEIGHT;

  // Sync dialog open/close with native dialog API and reset form when opening.
  // These are legitimate DOM imperative calls, not state synchronization.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) {
      dialog.showModal();
      reset({ weight: String(defaultWeight) });
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen, defaultWeight, reset]);

  // Block Escape key — prevent native cancel event from closing without our handler
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event): void => {
      e.preventDefault();
    };
    dialog.addEventListener('cancel', handleCancel);
    return (): void => {
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, []);

  // Synchronous submit: RHF's async handleSubmit would not be awaited by tests
  // that call fireEvent.click without a waitFor wrapper.
  const handleFormSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    if (!isWeightValid) return;
    onConfirm(parsedWeight);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="modal-box fixed inset-0 m-auto h-fit bg-card border border-rule p-6 max-w-sm w-[calc(100%-2rem)] shadow-dialog backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={handleFormSubmit}>
        <h3 id={titleId} className="text-sm font-bold text-title mb-2">
          {t('tracker.test_weight.title')} {liftName}
        </h3>

        <p className="text-xs text-muted leading-relaxed mb-4">
          {hasPropagationTarget
            ? t('tracker.test_weight.description_propagation')
            : t('tracker.test_weight.description_final')}
        </p>

        <label className="block text-xs font-medium text-main mb-1.5">
          {t('tracker.test_weight.weight_label')}
        </label>
        <input
          type="number"
          {...register('weight')}
          min={MIN_WEIGHT}
          max={MAX_WEIGHT}
          step={WEIGHT_STEP}
          className="w-full border border-rule bg-body text-main text-sm px-3 py-2.5 rounded focus:outline-none focus:ring-2 focus:ring-accent mb-4"
          autoFocus
        />

        <div className="border-t border-rule pt-4 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            {t('tracker.test_weight.cancel_button')}
          </Button>
          <Button type="submit" variant="primary" disabled={!isWeightValid || loading}>
            {loading
              ? t('tracker.test_weight.saving_loading')
              : t('tracker.test_weight.confirm_button')}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
