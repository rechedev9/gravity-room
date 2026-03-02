import { useEffect, useId, useRef, useState } from 'react';
import { Button } from './button';

const MIN_WEIGHT = 20;
const MAX_WEIGHT = 500;
const WEIGHT_STEP = 2.5;

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

function isValidWeight(value: string): boolean {
  if (value.trim() === '') return false;
  const num = Number(value);
  return Number.isFinite(num) && num >= MIN_WEIGHT && num <= MAX_WEIGHT;
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [weight, setWeight] = useState(String(defaultWeight));

  // Reset weight to defaultWeight when modal opens
  useEffect(() => {
    if (isOpen) {
      setWeight(String(defaultWeight));
    }
  }, [isOpen, defaultWeight]);

  // Sync open prop with native dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Block Escape key — prevent native cancel event
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

  const canConfirm = isValidWeight(weight) && !loading;

  const handleConfirm = (): void => {
    if (!canConfirm) return;
    onConfirm(Number(weight));
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    handleConfirm();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="modal-box fixed inset-0 m-auto h-fit bg-card border border-rule p-6 max-w-sm w-[calc(100%-2rem)] shadow-dialog backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <form onSubmit={handleSubmit}>
        <h3 id={titleId} className="text-sm font-bold text-title mb-2">
          Test Maximo — {liftName}
        </h3>

        <p className="text-xs text-muted leading-relaxed mb-4">
          {hasPropagationTarget
            ? 'Registra tu maximo. Este peso se usara como Training Max del siguiente bloque.'
            : 'Registra tu maximo. Este es tu resultado final del protocolo JAW.'}
        </p>

        <label className="block text-xs font-medium text-main mb-1.5">
          Cuanto levantaste? (kg)
        </label>
        <input
          type="number"
          value={weight}
          onChange={(e): void => setWeight(e.target.value)}
          min={MIN_WEIGHT}
          max={MAX_WEIGHT}
          step={WEIGHT_STEP}
          className="w-full border border-rule bg-body text-main text-sm px-3 py-2.5 rounded focus:outline-none focus:ring-2 focus:ring-accent mb-4"
          autoFocus
        />

        <div className="border-t border-rule pt-4 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={!canConfirm}>
            {loading ? 'Guardando...' : 'Confirmar'}
          </Button>
        </div>
      </form>
    </dialog>
  );
}
