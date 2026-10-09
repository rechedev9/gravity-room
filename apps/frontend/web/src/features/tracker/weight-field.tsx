import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUnitPreference } from '@/hooks/use-unit-preference';

interface WeightFieldProps {
  readonly fieldKey: string;
  readonly label: string;
  readonly value: string;
  readonly touched: boolean;
  readonly fieldError: string | null;
  readonly step: number;
  readonly min: number;
  readonly hint?: string;
  readonly onChange: (key: string, value: string) => void;
  readonly onBlur: (key: string, value: string) => void;
  readonly onAdjust: (key: string, delta: number) => void;
  readonly onSubmit: () => void;
}

export function WeightField({
  fieldKey,
  label,
  value,
  touched,
  fieldError,
  step,
  min,
  hint,
  onChange,
  onBlur,
  onAdjust,
  onSubmit,
}: WeightFieldProps): React.ReactNode {
  const { t } = useTranslation();
  const { toDisplay, fromDisplay, format } = useUnitPreference();
  const toDisplayText = (kgText: string): string => {
    const n = parseFloat(kgText);
    return Number.isNaN(n) ? kgText : String(toDisplay(n));
  };
  // `value` is kg; the box shows the preferred unit and keeps what the user is typing.
  const [draft, setDraft] = useState(() => toDisplayText(value));
  const typed = parseFloat(draft);
  const stored = parseFloat(value);
  const inSync = Number.isNaN(typed)
    ? Number.isNaN(stored)
    : !Number.isNaN(stored) && fromDisplay(typed) === stored;
  const shown = inSync ? draft : toDisplayText(value);
  const isValid = touched && !fieldError;
  const fieldId = `weight-${fieldKey}`;
  const errorId = `${fieldKey}-error`;

  return (
    <div>
      <label
        htmlFor={fieldId}
        className="block text-xs font-bold uppercase tracking-wide text-label mb-1.5"
      >
        {label}
      </label>
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => onAdjust(fieldKey, -step)}
          className="px-3 min-h-[44px] border-2 border-r-0 border-rule bg-card text-btn-text text-lg font-bold cursor-pointer hover:bg-hover-row hover:text-title transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          aria-label={t('tracker.weight_field.decrease_label', { label })}
        >
          &minus;
        </button>
        <input
          id={fieldId}
          type="number"
          inputMode="decimal"
          value={shown}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = parseFloat(e.target.value);
            onChange(fieldKey, Number.isNaN(n) ? e.target.value : String(fromDisplay(n)));
          }}
          onBlur={() => onBlur(fieldKey, value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          step="any"
          min={toDisplay(min)}
          max={toDisplay(500)}
          aria-invalid={fieldError ? 'true' : undefined}
          aria-describedby={fieldError ? errorId : undefined}
          className={`flex-1 min-w-0 px-3 py-2.5 border-2 text-base font-semibold bg-card text-main text-center focus:outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
            fieldError
              ? 'border-error-line focus:border-error-line'
              : isValid
                ? 'border-ok-ring focus:border-ok-ring'
                : 'border-rule focus:border-accent'
          }`}
        />
        <button
          type="button"
          onClick={() => onAdjust(fieldKey, step)}
          className="px-3 min-h-[44px] border-2 border-l-0 border-rule bg-card text-btn-text text-lg font-bold cursor-pointer hover:bg-hover-row hover:text-title transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          aria-label={t('tracker.weight_field.increase_label', { label })}
        >
          +
        </button>
      </div>
      {fieldError ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1 text-[11px] font-bold text-error mt-1"
        >
          <span aria-hidden="true">&#9888;</span> {fieldError}
        </p>
      ) : isValid ? (
        <p className="flex items-center gap-1 text-[11px] font-bold text-ok mt-1">
          <span aria-hidden="true">&#10003;</span> {t('tracker.weight_field.valid')}
        </p>
      ) : (
        <p className="text-[10px] text-muted mt-1">
          {hint ?? t('tracker.weight_field.min_hint', { min: format(min) })}
        </p>
      )}
    </div>
  );
}
