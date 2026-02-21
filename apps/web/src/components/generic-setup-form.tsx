import { useState, useCallback, useMemo } from 'react';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { ConfirmDialog } from './confirm-dialog';
import { WeightField } from './weight-field';

interface GenericSetupFormProps {
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

export function GenericSetupForm({
  definition,
  initialConfig,
  isGenerating,
  onGenerate,
  onUpdateConfig,
}: GenericSetupFormProps): React.ReactNode {
  const fields = definition.configFields;
  const isEditMode = initialConfig !== null && initialConfig !== undefined;
  const [isExpanded, setIsExpanded] = useState(!isEditMode);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of fields) {
      init[f.key] = String(initialConfig?.[f.key] ?? f.min);
    }
    return init;
  });

  const handleChange = useCallback(
    (key: string, value: string) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      const field = fields.find((f) => f.key === key);
      if (touched[key] && field) {
        setFieldErrors((prev) => ({ ...prev, [key]: validateField(value, field.min) }));
      }
    },
    [touched, fields]
  );

  const handleBlur = useCallback(
    (key: string, value: string) => {
      const field = fields.find((f) => f.key === key);
      setTouched((prev) => ({ ...prev, [key]: true }));
      if (field) {
        setFieldErrors((prev) => ({ ...prev, [key]: validateField(value, field.min) }));
      }
    },
    [fields]
  );

  const adjustWeight = useCallback(
    (key: string, delta: number) => {
      const field = fields.find((f) => f.key === key);
      const step = field?.step ?? 0.5;
      setValues((prev) => {
        const current = parseFloat(prev[key]) || 0;
        const next = Math.max(step, Math.round((current + delta) / step) * step);
        const nextStr = String(next);
        setTouched((t) => ({ ...t, [key]: true }));
        if (field) {
          setFieldErrors((fe) => ({ ...fe, [key]: validateField(nextStr, field.min) }));
        }
        return { ...prev, [key]: nextStr };
      });
    },
    [fields]
  );

  type ConfigField = ProgramDefinition['configFields'][number];
  interface FieldGroup {
    readonly label: string | null;
    readonly fields: ConfigField[];
  }

  const groupedFields = useMemo((): FieldGroup[] => {
    const groups: FieldGroup[] = [];
    let current: FieldGroup | null = null;
    for (const f of fields) {
      const label = f.group ?? null;
      if (!current || current.label !== label) {
        current = { label, fields: [f] };
        groups.push(current);
      } else {
        current.fields.push(f);
      }
    }
    return groups;
  }, [fields]);

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
        {isEditMode ? 'Editar Pesos Iniciales (kg)' : 'Pesos Iniciales (kg)'}
      </h2>
      <p className="text-[13px] text-[var(--text-muted)] mb-5">
        {isEditMode
          ? 'Actualiza tus pesos iniciales — el programa se recalculará con los nuevos valores'
          : `Ingresa tus pesos iniciales para ${definition.name}`}
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
          {isGenerating ? 'Generando...' : isEditMode ? 'Actualizar Pesos' : 'Generar Programa'}
        </button>
      </div>
    </>
  );

  return (
    <>
      {isEditMode ? (
        <>
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 sm:p-7 mb-7">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2
                  className="font-display mb-1 leading-none"
                  style={{ fontSize: '22px', color: 'var(--text-header)' }}
                >
                  Pesos Iniciales
                </h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {fields.length <= 4
                    ? fields.map((f) => `${f.label}: ${initialConfig[f.key]}kg`).join(' · ')
                    : fields
                        .slice(0, 4)
                        .map((f) => `${f.label}: ${initialConfig[f.key]}kg`)
                        .join(' · ') + ` · + ${fields.length - 4} more`}
                </p>
              </div>
              <button
                onClick={() => setIsExpanded(true)}
                className="px-4 py-2.5 min-h-[44px] border-2 border-[var(--btn-border)] text-xs font-bold cursor-pointer bg-[var(--btn-bg)] text-[var(--btn-text)] whitespace-nowrap transition-all hover:bg-[var(--btn-hover-bg)] hover:text-[var(--btn-hover-text)]"
              >
                Editar Pesos
              </button>
            </div>
          </div>

          {isExpanded && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60"
              onClick={() => setIsExpanded(false)}
            >
              <div
                className="bg-[var(--bg-card)] border border-[var(--border-color)] p-6 sm:p-8 max-w-2xl w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                {formContent}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] p-4 sm:p-7 mb-7 max-w-2xl mx-auto">
          {formContent}
        </div>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="Actualizar Pesos Iniciales"
        message="Esto recalculará todo el programa con los nuevos pesos iniciales. Tu historial de éxitos/fallos se conservará, pero los pesos proyectados cambiarán. ¿Continuar?"
        confirmLabel="Actualizar Pesos"
        onConfirm={handleConfirmUpdate}
        onCancel={handleCancelUpdate}
      />
    </>
  );
}
