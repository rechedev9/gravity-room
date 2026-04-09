import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod/v4';
import { captureError } from '@/lib/sentry';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { SelectField } from '@/components/select-field';
import { WeightField } from './weight-field';

interface SetupFormProps {
  readonly definition: ProgramDefinition;
  readonly initialConfig?: Record<string, number | string> | null;
  readonly isGenerating?: boolean;
  readonly onGenerate: (config: Record<string, number | string>) => Promise<void>;
  readonly onUpdateConfig?: (config: Record<string, number | string>) => void;
  /** Short status line shown in the collapsed card (e.g. current JAW block context). */
  readonly statusNote?: string;
  /** Group label to highlight in the edit modal as the currently active group. */
  readonly activeGroup?: string;
}

type ConfigField = ProgramDefinition['configFields'][number];

type FormValues = Record<string, string>;

function isWeightField(field: ConfigField): field is ConfigField & { type: 'weight' } {
  return field.type === 'weight';
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

/** Returns step value for a weight field, 1 for select fields. */
function getFieldStep(field: ConfigField): number {
  return isWeightField(field) ? field.step : 1;
}

/** Returns min value for a weight field, 0 for select fields. */
function getFieldMin(field: ConfigField): number {
  return isWeightField(field) ? field.min : 0;
}

interface FieldGroup {
  readonly label: string | null;
  readonly fields: readonly ConfigField[];
}

export function SetupForm({
  definition,
  initialConfig,
  isGenerating,
  onGenerate,
  onUpdateConfig,
  statusNote,
  activeGroup,
}: SetupFormProps): React.ReactNode {
  const fields = definition.configFields;
  const isEditMode = initialConfig !== null && initialConfig !== undefined;
  // Always start closed. isExpanded only controls the edit dialog (edit mode);
  // in create mode the form is always visible via the else branch and isExpanded
  // has no effect on rendering. Initialising to !isEditMode caused a bug:
  // after generating a program (create → edit mode), isExpanded stayed true so
  // setIsExpanded(true) became a no-op and the dialog never opened.
  const [isExpanded, setIsExpanded] = useState(false);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<Record<string, number | string> | null>(null);

  // Build dynamic Zod schema from configFields. Recomputed only when fields change.
  // Using z.record(string, string) + superRefine satisfies the RHF FieldValues constraint.
  const schema = useMemo((): z.ZodType<FormValues, FormValues> => {
    return z.record(z.string(), z.string()).superRefine((values, ctx) => {
      for (const f of fields) {
        const v = values[f.key] ?? '';
        if (isWeightField(f)) {
          const min = f.min ?? 1;
          const n = parseFloat(v);
          if (v.trim() === '' || isNaN(n)) {
            ctx.addIssue({ code: 'custom', path: [f.key], message: 'Valor inválido' });
          } else if (n < min) {
            ctx.addIssue({ code: 'custom', path: [f.key], message: `Mínimo ${min} kg` });
          } else if (n > 500) {
            ctx.addIssue({ code: 'custom', path: [f.key], message: 'Máximo 500 kg' });
          }
        } else {
          if (v.trim() === '') {
            ctx.addIssue({ code: 'custom', path: [f.key], message: 'Requerido' });
          }
        }
      }
    });
  }, [fields]);

  const defaultValues = useMemo((): FormValues => {
    const init: FormValues = {};
    for (const f of fields) {
      init[f.key] = getFieldDefault(f, initialConfig);
    }
    return init;
  }, [fields, initialConfig]);

  const {
    handleSubmit: rhfHandleSubmit,
    setValue,
    getValues,
    watch,
    trigger,
    formState: { errors, touchedFields, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    // In edit mode mark all fields touched so errors show immediately
    mode: isEditMode ? 'onChange' : 'onTouched',
  });

  // Subscribe to all field values so displayed weights are reactive to setValue calls.
  // Without this, getValues() in render returns a stale snapshot that doesn't update.
  const watchedValues = watch();

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

  const adjustWeight = (key: string, delta: number): void => {
    const field = fields.find((f) => f.key === key);
    const step = field ? getFieldStep(field) : 0.5;
    const min = field ? getFieldMin(field) : step;
    const current = parseFloat(getValues(key)) || 0;
    const next = Math.max(min, Math.round((current + delta) / step) * step);
    setValue(key, String(next), { shouldValidate: true, shouldTouch: true });
  };

  // Convert validated string values to the typed config format
  const parseConfig = (values: FormValues): Record<string, number | string> => {
    const parsed: Record<string, number | string> = {};
    for (const f of fields) {
      if (isWeightField(f)) {
        parsed[f.key] = parseFloat(values[f.key]);
      } else {
        parsed[f.key] = values[f.key];
      }
    }
    return parsed;
  };

  const onValid = (values: FormValues): void => {
    setError(null);
    const config = parseConfig(values);

    if (isEditMode && onUpdateConfig) {
      setPendingConfig(config);
      setShowConfirm(true);
    } else {
      onGenerate(config).catch((err: unknown) => {
        captureError(err);
        setError(err instanceof Error ? err.message : 'Error al generar el programa.');
      });
    }
  };

  const handleSubmit = (): void => {
    void rhfHandleSubmit(onValid)();
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

  const groupedFields = useMemo((): readonly FieldGroup[] => {
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
  }, [fields]);

  const fieldErrorsForDisplay: Record<string, string | null> = {};
  for (const f of fields) {
    fieldErrorsForDisplay[f.key] = errors[f.key]?.message ?? null;
  }

  const touchedForDisplay: Record<string, boolean> = {};
  for (const f of fields) {
    touchedForDisplay[f.key] = !!touchedFields[f.key];
  }

  const formContent = (
    <>
      <h2 className="font-display mb-1.5 leading-none text-title" style={{ fontSize: '28px' }}>
        {isEditMode
          ? (definition.configEditTitle ?? 'Editar Pesos Iniciales (kg)')
          : (definition.configTitle ?? 'Pesos Iniciales (kg)')}
      </h2>
      <p className="text-[13px] text-muted mb-5 whitespace-pre-line">
        {isEditMode
          ? (definition.configEditDescription ??
            'Actualiza tus pesos iniciales — el programa se recalculará con los nuevos valores')
          : (definition.configDescription ?? `Ingresa tus pesos iniciales para ${definition.name}`)}
      </p>

      <div className="mb-6 space-y-5">
        {groupedFields.map((group) => {
          const groupHint = group.fields
            .filter((f): f is ConfigField & { type: 'weight' } => f.type === 'weight')
            .find((f) => f.groupHint !== undefined)?.groupHint;
          const isActive = activeGroup !== undefined && group.label === activeGroup;
          return (
            <div key={group.label ?? '_ungrouped'}>
              {group.label && (
                <div className={`mb-2${isActive ? ' border-l-2 border-accent pl-2.5' : ''}`}>
                  <h3
                    className={`text-[11px] font-bold uppercase tracking-widest ${isActive ? 'text-accent' : 'text-muted'}`}
                  >
                    {group.label}
                    {isActive && (
                      <span className="ml-2 normal-case tracking-normal font-bold text-[9px]">
                        ← actualiza aquí
                      </span>
                    )}
                  </h3>
                  {groupHint && (
                    <p className="text-[11px] text-muted mt-0.5 leading-snug">{groupHint}</p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.fields.map((f) => {
                  const touched = touchedForDisplay[f.key] ?? false;
                  const fieldErr = touched ? (fieldErrorsForDisplay[f.key] ?? null) : null;
                  return isWeightField(f) ? (
                    <WeightField
                      key={f.key}
                      fieldKey={f.key}
                      label={f.label}
                      value={watchedValues[f.key] ?? getFieldDefault(f, initialConfig)}
                      touched={touched}
                      fieldError={fieldErr}
                      step={f.step}
                      min={f.min}
                      hint={f.hint}
                      onChange={(key, value) => {
                        setValue(key, value, { shouldValidate: touched, shouldTouch: false });
                      }}
                      onBlur={(key, value) => {
                        setValue(key, value, { shouldTouch: true });
                        void trigger(key);
                      }}
                      onAdjust={adjustWeight}
                      onSubmit={handleSubmit}
                    />
                  ) : (
                    <SelectField
                      key={f.key}
                      fieldKey={f.key}
                      label={f.label}
                      value={watchedValues[f.key] ?? getFieldDefault(f, initialConfig)}
                      options={f.options}
                      touched={touched}
                      fieldError={fieldErr}
                      onChange={(key, value) => {
                        setValue(key, value, { shouldValidate: true, shouldTouch: true });
                      }}
                      onBlur={(key, value) => {
                        setValue(key, value, { shouldTouch: true });
                        void trigger(key);
                      }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
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
                .filter((f) => fieldErrorsForDisplay[f.key])
                .map((f) => (
                  <li key={f.key}>
                    <button
                      type="button"
                      className="underline cursor-pointer bg-transparent border-none text-error p-0"
                      onClick={() => document.getElementById(`weight-${f.key}`)?.focus()}
                    >
                      {f.label}
                    </button>
                    : {fieldErrorsForDisplay[f.key]}
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
          disabled={(isGenerating ?? false) || isSubmitting}
          className="flex-1 py-3.5 border-none bg-header text-title text-base font-bold cursor-pointer hover:opacity-85 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
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
                  className="font-display mb-1 leading-none text-title"
                  style={{ fontSize: '22px' }}
                >
                  {definition.configTitle ?? 'Pesos Iniciales'}
                </h2>
                {statusNote && (
                  <p className="text-[11px] font-bold text-accent mb-1">{statusNote}</p>
                )}
                <p className="text-xs text-muted flex flex-wrap gap-x-3 gap-y-0.5 leading-relaxed">
                  {fields.slice(0, 4).map((f) => (
                    <span key={f.key}>
                      {f.label}: {initialConfig?.[f.key]}kg
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
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-muted hover:text-title transition-colors cursor-pointer"
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
