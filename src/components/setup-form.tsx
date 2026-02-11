'use client';

import { useState, useCallback } from 'react';
import { StartWeightsSchema } from '@/lib/schemas';
import type { StartWeights } from '@/types';
import { ConfirmDialog } from './confirm-dialog';

interface SetupFormProps {
  initialWeights?: StartWeights | null;
  onGenerate: (weights: StartWeights) => void;
  onUpdateWeights?: (weights: StartWeights) => void;
}

const FIELDS = [
  { key: 'squat', label: 'Squat (T1)', defaultVal: 60 },
  { key: 'bench', label: 'Bench Press (T1)', defaultVal: 40 },
  { key: 'deadlift', label: 'Deadlift (T1)', defaultVal: 60 },
  { key: 'ohp', label: 'OHP (T1)', defaultVal: 30 },
  { key: 'latpulldown', label: 'Lat Pulldown (T3)', defaultVal: 30 },
  { key: 'dbrow', label: 'DB Bent Over Row (T3)', defaultVal: 12.5 },
] as const;

const STEP = 2.5;

function validateField(value: string): string | null {
  const num = parseFloat(value);
  if (value.trim() === '' || isNaN(num)) return 'Required';
  if (num < 2.5) return 'Min 2.5 kg';
  if (num > 500) return 'Max 500 kg';
  if (num % 2.5 !== 0) return 'Must be multiple of 2.5';
  return null;
}

export function SetupForm({ initialWeights, onGenerate, onUpdateWeights }: SetupFormProps) {
  const isEditMode = initialWeights !== null && initialWeights !== undefined;
  const [isExpanded, setIsExpanded] = useState(!isEditMode);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingWeights, setPendingWeights] = useState<StartWeights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of FIELDS) {
      init[f.key] = String(initialWeights?.[f.key] ?? f.defaultVal);
    }
    return init;
  });

  const handleChange = useCallback(
    (key: string, value: string) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      if (touched[key]) {
        setFieldErrors((prev) => ({ ...prev, [key]: validateField(value) }));
      }
    },
    [touched]
  );

  const handleBlur = useCallback((key: string, value: string) => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    setFieldErrors((prev) => ({ ...prev, [key]: validateField(value) }));
  }, []);

  const adjustWeight = useCallback((key: string, delta: number) => {
    setValues((prev) => {
      const current = parseFloat(prev[key]) || 0;
      const next = Math.max(STEP, Math.round((current + delta) / STEP) * STEP);
      const nextStr = String(next);
      setTouched((t) => ({ ...t, [key]: true }));
      setFieldErrors((fe) => ({ ...fe, [key]: validateField(nextStr) }));
      return { ...prev, [key]: nextStr };
    });
  }, []);

  const validateAndParse = (): StartWeights | null => {
    setError(null);

    const errors: Record<string, string | null> = {};
    let hasError = false;
    for (const f of FIELDS) {
      const err = validateField(values[f.key]);
      errors[f.key] = err;
      if (err) hasError = true;
    }
    setFieldErrors(errors);
    setTouched(Object.fromEntries(FIELDS.map((f) => [f.key, true])));

    if (hasError) {
      setError('Please fix the highlighted fields.');
      return null;
    }

    const parsed: Record<string, number> = {};
    for (const f of FIELDS) {
      parsed[f.key] = parseFloat(values[f.key]);
    }

    const result = StartWeightsSchema.safeParse(parsed);
    if (!result.success) {
      setError('Invalid weights. Please check all fields.');
      return null;
    }

    return result.data;
  };

  const handleSubmit = (): void => {
    const weights = validateAndParse();
    if (!weights) return;

    if (isEditMode && onUpdateWeights) {
      setPendingWeights(weights);
      setShowConfirm(true);
    } else {
      onGenerate(weights);
    }
  };

  const handleConfirmUpdate = (): void => {
    if (pendingWeights && onUpdateWeights) {
      onUpdateWeights(pendingWeights);
      setPendingWeights(null);
      setIsExpanded(false);
    }
    setShowConfirm(false);
  };

  const handleCancelUpdate = (): void => {
    setPendingWeights(null);
    setShowConfirm(false);
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 sm:p-7 mb-7">
      {isEditMode && !isExpanded ? (
        /* Collapsed summary view */
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-sm font-bold mb-1">Starting Weights</h2>
            <p className="text-xs text-[var(--text-muted)]">
              {FIELDS.map((f) => `${f.label.split(' (')[0]}: ${initialWeights[f.key]}kg`).join(
                ' · '
              )}
            </p>
          </div>
          <button
            onClick={() => setIsExpanded(true)}
            className="px-4 py-2.5 min-h-[44px] border-2 border-[var(--btn-border)] text-xs font-bold cursor-pointer bg-[var(--btn-bg)] text-[var(--btn-text)] whitespace-nowrap transition-all hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)]"
          >
            Edit Weights
          </button>
        </div>
      ) : (
        /* Expanded form view */
        <>
          <h2 className="text-lg font-bold mb-1.5">
            {isEditMode ? 'Edit Starting Weights (kg)' : 'Starting Weights (kg)'}
          </h2>
          <p className="text-[13px] text-[var(--text-muted)] mb-5">
            {isEditMode
              ? 'Update your starting weights — the program will recalculate from these new values'
              : 'Enter your current working weight for T1 exercises (85% of 5RM recommended)'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {FIELDS.map((f) => {
              const fieldError = touched[f.key] ? fieldErrors[f.key] : null;
              const isValid = touched[f.key] && !fieldError;
              const fieldId = `weight-${f.key}`;
              const errorId = `${f.key}-error`;
              return (
                <div key={f.key}>
                  <label
                    htmlFor={fieldId}
                    className="block text-xs font-bold uppercase tracking-wide text-[var(--text-label)] mb-1.5"
                  >
                    {f.label}
                  </label>
                  <div className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => adjustWeight(f.key, -STEP)}
                      className="px-2.5 border-2 border-r-0 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--btn-text)] text-lg font-bold cursor-pointer hover:bg-[var(--bg-hover-row)] transition-colors"
                      aria-label={`Decrease ${f.label}`}
                    >
                      &minus;
                    </button>
                    <input
                      id={fieldId}
                      type="number"
                      inputMode="decimal"
                      value={values[f.key]}
                      onChange={(e) => handleChange(f.key, e.target.value)}
                      onBlur={() => handleBlur(f.key, values[f.key])}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                      step="2.5"
                      min="2.5"
                      max="500"
                      aria-invalid={fieldError ? 'true' : undefined}
                      aria-describedby={fieldError ? errorId : undefined}
                      className={`flex-1 min-w-0 px-3 py-2.5 border-2 text-base font-semibold bg-[var(--bg-card)] text-[var(--text-main)] text-center focus:outline-none transition-colors ${
                        fieldError
                          ? 'border-[var(--border-error)] focus:border-[var(--border-error)]'
                          : isValid
                            ? 'border-[var(--border-badge-ok)] focus:border-[var(--border-badge-ok)]'
                            : 'border-[var(--border-color)] focus:border-[var(--fill-progress)]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => adjustWeight(f.key, STEP)}
                      className="px-2.5 border-2 border-l-0 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--btn-text)] text-lg font-bold cursor-pointer hover:bg-[var(--bg-hover-row)] transition-colors"
                      aria-label={`Increase ${f.label}`}
                    >
                      +
                    </button>
                  </div>
                  {fieldError ? (
                    <p
                      id={errorId}
                      role="alert"
                      className="flex items-center gap-1 text-[11px] font-bold text-[var(--text-error)] mt-1"
                    >
                      <span aria-hidden="true">&#9888;</span> {fieldError}
                    </p>
                  ) : isValid ? (
                    <p className="flex items-center gap-1 text-[11px] font-bold text-[var(--text-badge-ok)] mt-1">
                      <span aria-hidden="true">&#10003;</span> Valid
                    </p>
                  ) : (
                    <p className="text-[10px] text-[var(--text-muted)] mt-1">Multiples of 2.5 kg</p>
                  )}
                </div>
              );
            })}
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 text-[var(--text-error)] font-bold mb-3 p-2.5 bg-[var(--bg-error)] border-2 border-[var(--border-error)]"
            >
              <span className="shrink-0 text-sm" aria-hidden="true">
                &#9888;
              </span>
              <div className="flex-1">
                <p className="text-xs mb-1">Please fix the following:</p>
                <ul className="text-[11px] font-normal list-disc ml-4">
                  {FIELDS.filter((f) => fieldErrors[f.key]).map((f) => (
                    <li key={f.key}>
                      <button
                        type="button"
                        className="underline cursor-pointer bg-transparent border-none text-[var(--text-error)] p-0"
                        onClick={() => document.getElementById(`weight-${f.key}`)?.focus()}
                      >
                        {f.label.split(' (')[0]}
                      </button>
                      : {fieldErrors[f.key]}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            {isEditMode && (
              <button
                onClick={() => setIsExpanded(false)}
                className="flex-1 py-3.5 border-2 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] text-base font-bold cursor-pointer hover:bg-[var(--bg-hover-row)] hover:text-[var(--text-main)] transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleSubmit}
              className="flex-1 py-3.5 border-none bg-[var(--bg-header)] text-[var(--text-header)] text-base font-bold cursor-pointer hover:opacity-85 transition-opacity"
            >
              {isEditMode ? 'Update Weights' : 'Generate Program'}
            </button>
          </div>
        </>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="Update Starting Weights"
        message="This will recalculate the entire program from the new starting weights. Your pass/fail history will be preserved, but projected weights will change. Continue?"
        confirmLabel="Update Weights"
        onConfirm={handleConfirmUpdate}
        onCancel={handleCancelUpdate}
      />
    </div>
  );
}
