import { useState, useEffect } from 'react';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { ConfirmDialog } from './confirm-dialog';
import { WeightField } from './weight-field';

interface SetupFormProps {
  readonly definition: ProgramDefinition;
  readonly initialConfig?: Record<string, number> | null;
  readonly isGenerating?: boolean;
  readonly onGenerate: (config: Record<string, number>) => Promise<void>;
  readonly onUpdateConfig?: (config: Record<string, number>) => void;
}

function validateField(value: string, min: number): string | null {
  const num = parseFloat(value);
  if (value.trim() === '' || isNaN(num)) return 'Requerido';
  if (num < min) return `Mín ${min} kg`;
  if (num > 500) return 'Máx 500 kg';
  return null;
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

  useEffect(() => {
    if (!isExpanded) return;
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setIsExpanded(false);
    };
    document.addEventListener('keydown', handleKey);
    return (): void => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [isExpanded]);

  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      init[f.key] = String(initialConfig?.[f.key] ?? f.min);
    }
    return init;
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>(() => {
    if (!isEditMode) return {};
    const init: Record<string, string | null> = {};
    for (const f of fields) {
      const val = String(initialConfig?.[f.key] ?? f.min);
      init[f.key] = validateField(val, f.min);
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
      setFieldErrors((prev) => ({ ...prev, [key]: validateField(value, field.min) }));
    }
  };

  const handleBlur = (key: string, value: string): void => {
    const field = fields.find((f) => f.key === key);
    setTouched((prev) => ({ ...prev, [key]: true }));
    if (field) {
      setFieldErrors((prev) => ({ ...prev, [key]: validateField(value, field.min) }));
    }
  };

  const adjustWeight = (key: string, delta: number): void => {
    const field = fields.find((f) => f.key === key);
    const step = field?.step ?? 0.5;
    const min = field?.min ?? step;
    setValues((prev) => {
      const current = parseFloat(prev[key]) || 0;
      const next = Math.max(min, Math.round((current + delta) / step) * step);
      const nextStr = String(next);
      setTouched((t) => ({ ...t, [key]: true }));
      if (field) {
        setFieldErrors((fe) => ({ ...fe, [key]: validateField(nextStr, field.min) }));
      }
      return { ...prev, [key]: nextStr };
    });
  };

  type ConfigField = ProgramDefinition['configFields'][number];
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

  const validateAndParse = (): Record<string, number> | null => {
    setError(null);

    const errors: Record<string, string | null> = {};
    let hasError = false;
    for (const f of fields) {
      const err = validateField(values[f.key], f.min);
      errors[f.key] = err;
      if (err) hasError = true;
    }
    setFieldErrors(errors);
    setTouched(Object.fromEntries(fields.map((f) => [f.key, true])));

    if (hasError) {
      setError('Por favor corrige los campos resaltados.');
      return null;
    }

    const parsed: Record<string, number> = {};
    for (const f of fields) {
      parsed[f.key] = parseFloat(values[f.key]);
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
      <h2
        className="font-display mb-1.5 leading-none"
        style={{ fontSize: '28px', color: 'var(--text-header)' }}
      >
        {isEditMode
          ? (definition.configEditTitle ?? 'Editar Pesos Iniciales (kg)')
          : (definition.configTitle ?? 'Pesos Iniciales (kg)')}
      </h2>
      <p className="text-[13px] text-[var(--text-muted)] mb-5">
        {isEditMode
          ? (definition.configEditDescription ??
            'Actualiza tus pesos iniciales — el programa se recalculará con los nuevos valores')
          : (definition.configDescription ?? `Ingresa tus pesos iniciales para ${definition.name}`)}
      </p>

      <div className="mb-6 space-y-5">
        {groupedFields.map((group) => (
          <div key={group.label ?? '_ungrouped'}>
            {group.label && (
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
                {group.label}
              </h3>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {group.fields.map((f) => (
                <WeightField
                  key={f.key}
                  fieldKey={f.key}
                  label={f.label}
                  value={values[f.key]}
                  touched={!!touched[f.key]}
                  fieldError={touched[f.key] ? (fieldErrors[f.key] ?? null) : null}
                  step={f.step}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  onAdjust={adjustWeight}
                  onSubmit={handleSubmit}
                />
              ))}
            </div>
          </div>
        ))}
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
            <p className="text-xs mb-1">Por favor corrige lo siguiente:</p>
            <ul className="text-[11px] font-normal list-disc ml-4">
              {fields
                .filter((f) => fieldErrors[f.key])
                .map((f) => (
                  <li key={f.key}>
                    <button
                      type="button"
                      className="underline cursor-pointer bg-transparent border-none text-[var(--text-error)] p-0"
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
            className="flex-1 py-3.5 border-2 border-[var(--border-color)] bg-[var(--bg-card)] text-[var(--text-muted)] text-base font-bold cursor-pointer hover:bg-[var(--bg-hover-row)] hover:text-[var(--text-main)] transition-colors"
          >
            Cancelar
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={isGenerating}
          className="flex-1 py-3.5 border-none bg-[var(--bg-header)] text-[var(--text-header)] text-base font-bold cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 sm:p-7 mb-7 card">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2
                  className="font-display mb-1 leading-none"
                  style={{ fontSize: '22px', color: 'var(--text-header)' }}
                >
                  {definition.configTitle ?? 'Pesos Iniciales'}
                </h2>
                <p className="text-xs text-[var(--text-muted)] flex flex-wrap gap-x-3 gap-y-0.5 leading-relaxed">
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
                className="px-4 py-2.5 min-h-[44px] border-2 border-[var(--btn-border)] text-xs font-bold cursor-pointer bg-[var(--btn-bg)] text-[var(--btn-text)] whitespace-nowrap transition-all hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)]"
              >
                {definition.configEditTitle ? 'Editar' : 'Editar Pesos'}
              </button>
            </div>
          </div>

          {isExpanded && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
              onClick={() => setIsExpanded(false)}
            >
              <div
                className="relative modal-box bg-[var(--bg-card)] border border-[var(--border-color)] p-6 sm:p-8 max-w-2xl w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto"
                style={{ boxShadow: 'var(--shadow-elevated), 0 0 60px rgba(0, 0, 0, 0.5)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-header)] transition-colors cursor-pointer"
                  aria-label="Cerrar"
                >
                  &#10005;
                </button>
                {formContent}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 sm:p-7 mb-7 max-w-2xl mx-auto card edge-glow-top">
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
