interface SelectFieldProps {
  readonly fieldKey: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  readonly touched: boolean;
  readonly fieldError: string | null;
  readonly onChange: (key: string, value: string) => void;
  readonly onBlur: (key: string, value: string) => void;
}

export function SelectField({
  fieldKey,
  label,
  value,
  options,
  touched,
  fieldError,
  onChange,
  onBlur,
}: SelectFieldProps): React.ReactNode {
  const isValid = touched && !fieldError;
  const fieldId = `select-${fieldKey}`;
  const errorId = `${fieldKey}-error`;

  return (
    <div>
      <label
        htmlFor={fieldId}
        className="block text-xs font-bold uppercase tracking-wide text-label mb-1.5"
      >
        {label}
      </label>
      <select
        id={fieldId}
        value={value}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        onBlur={(e) => onBlur(fieldKey, e.target.value)}
        aria-invalid={fieldError ? 'true' : undefined}
        aria-describedby={fieldError ? errorId : undefined}
        className={`w-full h-11 px-3 border-2 bg-card text-main text-sm cursor-pointer focus:outline-none transition-colors ${
          fieldError
            ? 'border-error-line focus:border-error-line'
            : isValid
              ? 'border-ok-ring focus:border-ok-ring'
              : 'border-rule focus:border-accent'
        }`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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
          <span aria-hidden="true">&#10003;</span> Seleccionado
        </p>
      ) : null}
    </div>
  );
}
