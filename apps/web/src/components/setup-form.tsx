import { useState, useEffect, useRef } from 'react';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { ConfirmDialog } from './confirm-dialog';
import { SelectField } from './select-field';
import { WeightField } from './weight-field';

interface SetupFormProps {
  readonly definition: ProgramDefinition;
  readonly initialConfig?: Record<string, number | string> | null;
  readonly isGenerating?: boolean;
  readonly onGenerate: (config: Record<string, number | string>) => Promise<void>;
  readonly onUpdateConfig?: (config: Record<string, number | string>) => void;
}

type ConfigField = ProgramDefinition['configFields'][number];

function isWeightField(field: ConfigField): field is ConfigField & { type: 'weight' } {
  return field.type === 'weight';
}

function validateField(value: string, min: number): string | null {
  const num = parseFloat(value);
  if (value.trim() === '' || isNaN(num)) return 'Requerido';
  if (num < min) return `Mín ${min} kg`;
  if (num > 500) return 'Máx 500 kg';
  return null;
}

function validateConfigField(field: ConfigField, value: string): string | null {
  if (isWeightField(field)) {
    return validateField(value, field.min);
  }
  // Select fields: just check a value was selected
  if (value.trim() === '') return 'Requerido';
  return null;
}

/** Returns the default display value for a config field. */
function getFieldDefault(
  field: ConfigField,
  initialConfig?: Record<string, number | string> | null
): string {
  if (initialConfig?.[field.key] !== undefined) {
    return String(initialConfig[field.key]);
  }
  if (isWeightField(field)) return String(field.min);
  // Select: default to first option's value
  return field.options[0]?.value ?? '';
}

/** Returns min value for a weight field, 0 for select fields. */
function getFieldMin(field: ConfigField): number {
  return isWeightField(field) ? field.min : 0;
}

/** Returns step value for a weight field, 1 for select fields. */
function getFieldStep(field: ConfigField): number {
  return isWeightField(field) ? field.step : 1;
}

export function SetupForm({
  definition,
  initialConfig,
  isGenerating,
  onGenerate,
  onUpdateConfig,
}: SetupFormProps): React.ReactNode {
  const fields = definition.configFields;
  const isEditMode = initialConfig !== null && initialConfig !== undefined;
  const [isExpanded, setIsExpanded] = useState(!isEditMode);
  const editDialogRef = useRef<HTMLDialogElement>(null);

  // Sync isExpanded with native dialog open/close
  useEffect(() => {
    const dialog = editDialogRef.current;
    if (!dialog) return;
    if (isExpanded && !dialog.open) {
      dialog.showModal();
    } else if (!isExpanded && dialog.open) {
      dialog.close();
    }
  }, [isExpanded]);

  // Native cancel event (Escape) → close the edit modal
  useEffect(() => {
    const dialog = editDialogRef.current;
    if (!dialog) return;
    const handleCancel = (e: Event): void => {
      e.preventDefault();
      setIsExpanded(false);
    };
    dialog.addEventListener('cancel', handleCancel);
    return (): void => {
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, []);

  // Auto-focus first field on initial setup (not edit mode)
  const firstFieldKey = fields[0]?.key;
  useEffect(() => {
    if (!isEditMode && firstFieldKey) {
      document.getElementById(`weight-${firstFieldKey}`)?.focus();
    }
  }, [isEditMode, firstFieldKey]);

  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<Record<string, number | string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      init[f.key] = getFieldDefault(f, initialConfig);
    }
    return init;
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>(() => {
    if (!isEditMode) return {};
    const init: Record<string, string | null> = {};
    for (const f of fields) {
      const val = getFieldDefault(f, initialConfig);
      init[f.key] = validateConfigField(f, val);
    }
    return init;
  });
  const [touched, setTouched] = useState<Record<string, boolean>>(() => {
    if (!isEditMode) return {};
    const init: Record<string, boolean> = {};
    for (const f of fields) {
      init[f.key] = true;
    }
    return init;
  });

  const handleChange = (key: string, value: string): void => {
    setValues((prev) => ({ ...prev, [key]: value }));
    const field = fields.find((f) => f.key === key);
    if (touched[key] && field) {
      setFieldErrors((prev) => ({ ...prev, [key]: validateConfigField(field, value) }));
    }
  };

  const handleBlur = (key: string, value: string): void => {
    const field = fields.find((f) => f.key === key);
    setTouched((prev) => ({ ...prev, [key]: true }));
    if (field) {
      setFieldErrors((prev) => ({ ...prev, [key]: validateConfigField(field, value) }));
    }
  };

  const adjustWeight = (key: string, delta: number): void => {
    const field = fields.find((f) => f.key === key);
    const step = field ? getFieldStep(field) : 0.5;
    const min = field ? getFieldMin(field) : step;
    setValues((prev) => {
      const current = parseFloat(prev[key]) || 0;
      const next = Math.max(min, Math.round((current + delta) / step) * step);
      const nextStr = String(next);
      setTouched((t) => ({ ...t, [key]: true }));
      if (field) {
        setFieldErrors((fe) => ({ ...fe, [key]: validateConfigField(field, nextStr) }));
      }
      return { ...prev, [key]: nextStr };
    });
  };

  interface FieldGroup {
    readonly label: string | null;
    readonly fields: readonly ConfigField[];
  }

  const groupedFields: readonly FieldGroup[] = (() => {
    const groups: FieldGroup[] = [];
    let pending: { label: string | null; items: ConfigField[] } | null = null;
    for (const f of fields) {
      const label = f.group ?? null;
      if (!pending || pending.label !== label) {
        if (pending) groups.push({ label: pending.label, fields: pending.items });
        pending = { label, items: [f] };
      } else {
        pending.items.push(f);
      }
    }
    if (pending) groups.push({ label: pending.label, fields: pending.items });
    return groups;
  })();

  const validateAndParse = (): Record<string, number | string> | null => {
    setError(null);

    const errors: Record<string, string | null> = {};
    let hasError = false;
    for (const f of fields) {
      const err = validateConfigField(f, values[f.key]);
      errors[f.key] = err;
      if (err) hasError = true;
    }
    setFieldErrors(errors);
    setTouched(Object.fromEntries(fields.map((f) => [f.key, true])));

    if (hasError) {
      setError('Por favor corrige los campos resaltados.');
      return null;
    }

    const parsed: Record<string, number | string> = {};
    for (const f of fields) {
      if (isWeightField(f)) {
        parsed[f.key] = parseFloat(values[f.key]);
      } else {
        // Select fields: pass through as string
        parsed[f.key] = values[f.key];
      }
    }

    return parsed;
  };

  const handleSubmit = (): void => {
    const config = validateAndParse();
    if (!config) return;

    if (isEditMode && onUpdateConfig) {
      setPendingConfig(config);
      setShowConfirm(true);
    } else {
      onGenerate(config).catch((err: unknown) => {
        console.error(
          '[setup] Program generation failed:',
          err instanceof Error ? err.message : err
        );
        setError(err instanceof Error ? err.message : 'Error al generar el programa.');
      });
    }
  };

  const handleConfirmUpdate = (): void => {
    if (pendingConfig && onUpdateConfig) {
      onUpdateConfig(pendingConfig);
      setPendingConfig(null);
      setIsExpanded(false);
    }
    setShowConfirm(false);
  };

  const handleCancelUpdate = (): void => {
    setPendingConfig(null);
    setShowConfirm(false);
  };

  const formContent = (
    <>
      <h2 className="font-display mb-1.5 leading-none text-heading" style={{ fontSize: '28px' }}>
        {isEditMode
          ? (definition.configEditTitle ?? 'Editar Pesos Iniciales (kg)')
          : (definition.configTitle ?? 'Pesos Iniciales (kg)')}
      </h2>
      <p className="text-[13px] text-muted mb-5">
        {isEditMode
          ? (definition.configEditDescription ??
            'Actualiza tus pesos iniciales — el programa se recalculará con los nuevos valores')
          : (definition.configDescription ?? `Ingresa tus pesos iniciales para ${definition.name}`)}
      </p>

      <div className="mb-6 space-y-5">
        {groupedFields.map((group) => (
          <div key={group.label ?? '_ungrouped'}>
            {group.label && (
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-muted mb-2">
                {group.label}
              </h3>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.fields.map((f) =>
                isWeightField(f) ? (
                  <WeightField
                    key={f.key}
                    fieldKey={f.key}
                    label={f.label}
                    value={values[f.key]}
                    touched={!!touched[f.key]}
                    fieldError={touched[f.key] ? (fieldErrors[f.key] ?? null) : null}
                    step={f.step}
                    min={f.min}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    onAdjust={adjustWeight}
                    onSubmit={handleSubmit}
                  />
                ) : (
                  <SelectField
                    key={f.key}
                    fieldKey={f.key}
                    label={f.label}
                    value={values[f.key]}
                    options={f.options}
                    touched={!!touched[f.key]}
                    fieldError={touched[f.key] ? (fieldErrors[f.key] ?? null) : null}
                    onChange={handleChange}
                    onBlur={handleBlur}
                  />
                )
              )}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 text-error font-bold mb-3 p-2.5 bg-error-bg border-2 border-error-line"
        >
          <span className="shrink-0 text-sm" aria-hidden="true">
            &#9888;
          </span>
          <div className="flex-1">
            <p className="text-xs mb-1">Por favor corrige lo siguiente:</p>
            <ul className="text-[11px] font-normal list-disc ml-4">
              {fields
                .filter((f) => fieldErrors[f.key])
                .map((f) => (
                  <li key={f.key}>
                    <button
                      type="button"
                      className="underline cursor-pointer bg-transparent border-none text-error p-0"
                      onClick={() => document.getElementById(`weight-${f.key}`)?.focus()}
                    >
                      {f.label}
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
            className="flex-1 py-3.5 border-2 border-rule bg-card text-muted text-base font-bold cursor-pointer hover:bg-hover-row hover:text-main transition-colors"
          >
            Cancelar
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={isGenerating}
          className="flex-1 py-3.5 border-none bg-header text-heading text-base font-bold cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating
            ? 'Generando...'
            : isEditMode
              ? definition.configEditTitle
                ? 'Actualizar'
                : 'Actualizar Pesos'
              : 'Generar Programa'}
        </button>
      </div>
    </>
  );

  return (
    <>
      {isEditMode ? (
        <>
          <div className="bg-card border border-rule p-4 sm:p-7 mb-7 card">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2
                  className="font-display mb-1 leading-none text-heading"
                  style={{ fontSize: '22px' }}
                >
                  {definition.configTitle ?? 'Pesos Iniciales'}
                </h2>
                <p className="text-xs text-muted flex flex-wrap gap-x-3 gap-y-0.5 leading-relaxed">
                  {fields.slice(0, 4).map((f) => (
                    <span key={f.key}>
                      {f.label}: {initialConfig[f.key]}kg
                    </span>
                  ))}
                  {fields.length > 4 && <span>+{fields.length - 4} más</span>}
                </p>
              </div>
              <button
                onClick={() => setIsExpanded(true)}
                className="px-4 py-2.5 min-h-[44px] border-2 border-btn-ring text-xs font-bold cursor-pointer bg-btn text-btn-text whitespace-nowrap transition-all hover:bg-btn-active hover:text-btn-active-text"
              >
                {definition.configEditTitle ? 'Editar' : 'Editar Pesos'}
              </button>
            </div>
          </div>

          <dialog
            ref={editDialogRef}
            className="relative modal-box bg-card border border-rule p-6 sm:p-8 max-w-2xl w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto shadow-dialog backdrop:bg-black/60 backdrop:backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === editDialogRef.current) setIsExpanded(false);
            }}
          >
            <button
              type="button"
              onClick={() => setIsExpanded(false)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-muted hover:text-heading transition-colors cursor-pointer"
              aria-label="Cerrar"
            >
              &#10005;
            </button>
            {formContent}
          </dialog>
        </>
      ) : (
        <div className="bg-card border border-rule p-4 sm:p-7 mb-7 max-w-2xl mx-auto card edge-glow-top">
          {formContent}
        </div>
      )}

      <ConfirmDialog
        open={showConfirm}
        title={definition.configEditTitle ?? 'Actualizar Pesos Iniciales'}
        message={
          definition.configEditDescription
            ? `${definition.configEditDescription} Tu historial de éxitos/fallos se conservará, pero los pesos proyectados cambiarán. ¿Continuar?`
            : 'Esto recalculará todo el programa con los nuevos pesos iniciales. Tu historial de éxitos/fallos se conservará, pero los pesos proyectados cambiarán. ¿Continuar?'
        }
        confirmLabel={definition.configEditTitle ? 'Actualizar' : 'Actualizar Pesos'}
        onConfirm={handleConfirmUpdate}
        onCancel={handleCancelUpdate}
      />
    </>
  );
}
