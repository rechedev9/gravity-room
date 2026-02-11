'use client';

import { useState, useCallback } from 'react';
import { StartWeightsSchema } from '@/lib/schemas';
import type { StartWeights } from '@/types';

interface SetupFormProps {
  initialWeights?: StartWeights | null;
  onGenerate: (weights: StartWeights) => void;
}

const FIELDS = [
  { key: 'squat', label: 'Squat (T1)', defaultVal: 60 },
  { key: 'bench', label: 'Bench Press (T1)', defaultVal: 40 },
  { key: 'deadlift', label: 'Deadlift (T1)', defaultVal: 60 },
  { key: 'ohp', label: 'OHP (T1)', defaultVal: 30 },
  { key: 'latpulldown', label: 'Lat Pulldown (T3)', defaultVal: 30 },
  { key: 'dbrow', label: 'DB Bent Over Row (T3)', defaultVal: 12 },
] as const;

function validateField(value: string): string | null {
  const num = parseFloat(value);
  if (value.trim() === '' || isNaN(num)) return 'Required';
  if (num < 2.5) return 'Min 2.5 kg';
  if (num > 500) return 'Max 500 kg';
  if (num % 2.5 !== 0) return 'Must be multiple of 2.5';
  return null;
}

export function SetupForm({ initialWeights, onGenerate }: SetupFormProps) {
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

  const handleSubmit = () => {
    setError(null);

    // Validate all fields
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
      return;
    }

    const parsed: Record<string, number> = {};
    for (const f of FIELDS) {
      parsed[f.key] = parseFloat(values[f.key]);
    }

    const result = StartWeightsSchema.safeParse(parsed);
    if (!result.success) {
      setError('Invalid weights. Please check all fields.');
      return;
    }

    onGenerate(result.data);
  };

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-7 mb-7">
      <h2 className="text-lg font-bold mb-1.5">Starting Weights (kg)</h2>
      <p className="text-[13px] text-[var(--text-muted)] mb-5">
        Enter your current working weight for T1 exercises (85% of 5RM recommended)
      </p>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-4 mb-6">
        {FIELDS.map((f) => {
          const fieldError = touched[f.key] ? fieldErrors[f.key] : null;
          return (
            <div key={f.key}>
              <label className="block text-xs font-bold uppercase tracking-wide text-[var(--text-label)] mb-1.5">
                {f.label}
              </label>
              <input
                type="number"
                inputMode="decimal"
                value={values[f.key]}
                onChange={(e) => handleChange(f.key, e.target.value)}
                onBlur={() => handleBlur(f.key, values[f.key])}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                step="2.5"
                min="2.5"
                max="500"
                className={`w-full px-3 py-2.5 border-2 text-base font-semibold bg-[var(--bg-card)] text-[var(--text-main)] focus:outline-none transition-colors ${
                  fieldError
                    ? 'border-[var(--border-error)] focus:border-[var(--border-error)]'
                    : 'border-[var(--border-color)] focus:border-[var(--fill-progress)]'
                }`}
              />
              {fieldError && (
                <p className="text-[11px] font-bold text-[var(--text-error)] mt-1">{fieldError}</p>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="text-[var(--text-error)] font-bold mb-3 p-2.5 bg-[var(--bg-error)] border-2 border-[var(--border-error)]">
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        className="w-full py-3.5 border-none bg-[var(--bg-header)] text-[var(--text-header)] text-base font-bold cursor-pointer hover:opacity-85 transition-opacity"
      >
        Generate Program
      </button>
    </div>
  );
}
