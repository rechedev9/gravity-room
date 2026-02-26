interface WeightFieldProps {
  readonly fieldKey: string;
  readonly label: string;
  readonly value: string;
  readonly touched: boolean;
  readonly fieldError: string | null;
  readonly step: number;
  readonly min: number;
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
  onChange,
  onBlur,
  onAdjust,
  onSubmit,
}: WeightFieldProps): React.ReactNode {
  const isValid = touched && !fieldError;
  const fieldId = `weight-${fieldKey}`;
  const errorId = `${fieldKey}-error`;

  return (
    <div>
      <label
        htmlFor={fieldId}
        className="block text-xs font-bold uppercase tracking-wide text-[var(--text-label)] mb-1.5"
      >
        {label}
      </label>
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => onAdjust(fieldKey, -step)}
          className="px-3 min-h-[44px] border-2 border-r-0 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--btn-text)] text-lg font-bold cursor-pointer hover:bg-[var(--bg-hover-row)] hover:text-[var(--text-header)] transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--fill-progress)] focus-visible:outline-none"
          aria-label={`Disminuir ${label}`}
        >
          &minus;
        </button>
        <input
          id={fieldId}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          onBlur={() => onBlur(fieldKey, value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          step="any"
          min={min}
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
          onClick={() => onAdjust(fieldKey, step)}
          className="px-3 min-h-[44px] border-2 border-l-0 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--btn-text)] text-lg font-bold cursor-pointer hover:bg-[var(--bg-hover-row)] hover:text-[var(--text-header)] transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-[var(--fill-progress)] focus-visible:outline-none"
          aria-label={`Aumentar ${label}`}
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
          <span aria-hidden="true">&#10003;</span> Válido
        </p>
      ) : (
        <p className="text-[10px] text-[var(--text-muted)] mt-1">Mín {min} kg</p>
      )}
    </div>
  );
}
