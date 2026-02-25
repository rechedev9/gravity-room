import { useState, useEffect } from 'react';
import { StartWeightsSchema } from '@gzclp/shared/schemas/legacy';
import type { StartWeights } from '@gzclp/shared/types';
import { Button } from './button';
import { ConfirmDialog } from './confirm-dialog';
import { WeightField } from './weight-field';

interface SetupFormProps {
  initialWeights?: StartWeights | null;
  isGenerating?: boolean;
  onGenerate: (weights: StartWeights) => Promise<void>;
  onUpdateWeights?: (weights: StartWeights) => void;
}

const FIELDS = [
  { key: 'squat', label: 'Sentadilla (T1)', defaultVal: 60 },
  { key: 'bench', label: 'Press Banca (T1)', defaultVal: 40 },
  { key: 'deadlift', label: 'Peso Muerto (T1)', defaultVal: 60 },
  { key: 'ohp', label: 'Press Militar (T1)', defaultVal: 30 },
  { key: 'latpulldown', label: 'Jalón al Pecho (T3)', defaultVal: 30 },
  { key: 'dbrow', label: 'Remo con Mancuernas (T3)', defaultVal: 12.5 },
] as const;

const STEP = 0.5;

function validateField(value: string): string | null {
  const num = parseFloat(value);
  if (value.trim() === '' || isNaN(num)) return 'Requerido';
  if (num < 2.5) return 'Mín 2.5 kg';
  if (num > 500) return 'Máx 500 kg';

  return null;
}

export function SetupForm({
  initialWeights,
  isGenerating,
  onGenerate,
  onUpdateWeights,
}: SetupFormProps) {
  const isEditMode = initialWeights !== null && initialWeights !== undefined;
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
  const [pendingWeights, setPendingWeights] = useState<StartWeights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of FIELDS) {
      init[f.key] = String(initialWeights?.[f.key] ?? f.defaultVal);
    }
    return init;
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | null>>(() => {
    if (!isEditMode) return {};
    const init: Record<string, string | null> = {};
    for (const f of FIELDS) {
      const val = String(initialWeights?.[f.key] ?? f.defaultVal);
      init[f.key] = validateField(val);
    }
    return init;
  });
  const [touched, setTouched] = useState<Record<string, boolean>>(() => {
    if (!isEditMode) return {};
    const init: Record<string, boolean> = {};
    for (const f of FIELDS) {
      init[f.key] = true;
    }
    return init;
  });

  const handleChange = (key: string, value: string): void => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (touched[key]) {
      setFieldErrors((prev) => ({ ...prev, [key]: validateField(value) }));
    }
  };

  const handleBlur = (key: string, value: string): void => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    setFieldErrors((prev) => ({ ...prev, [key]: validateField(value) }));
  };

  const MIN_WEIGHT = 2.5;

  const adjustWeight = (key: string, delta: number): void => {
    setValues((prev) => {
      const current = parseFloat(prev[key]) || 0;
      const next = Math.max(MIN_WEIGHT, Math.round((current + delta) / STEP) * STEP);
      const nextStr = String(next);
      setTouched((t) => ({ ...t, [key]: true }));
      setFieldErrors((fe) => ({ ...fe, [key]: validateField(nextStr) }));
      return { ...prev, [key]: nextStr };
    });
  };

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
      setError('Por favor corrige los campos resaltados.');
      return null;
    }

    const parsed: Record<string, number> = {};
    for (const f of FIELDS) {
      parsed[f.key] = parseFloat(values[f.key]);
    }

    const result = StartWeightsSchema.safeParse(parsed);
    if (!result.success) {
      setError('Pesos inválidos. Por favor revisa todos los campos.');
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
      onGenerate(weights)
        .then(() => setIsExpanded(false))
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Error al generar el programa.');
        });
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
          : 'Ingresa tu peso de trabajo actual para ejercicios T1 (85% de tu 5RM recomendado)'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {FIELDS.map((f) => (
          <WeightField
            key={f.key}
            fieldKey={f.key}
            label={f.label}
            value={values[f.key]}
            touched={!!touched[f.key]}
            fieldError={touched[f.key] ? (fieldErrors[f.key] ?? null) : null}
            step={STEP}
            onChange={handleChange}
            onBlur={handleBlur}
            onAdjust={adjustWeight}
            onSubmit={handleSubmit}
          />
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
          <Button variant="ghost" size="lg" onClick={() => setIsExpanded(false)}>
            Cancelar
          </Button>
        )}
        <Button variant="primary" size="lg" onClick={handleSubmit} disabled={isGenerating}>
          {isGenerating ? 'Generando...' : isEditMode ? 'Actualizar Pesos' : 'Generar Programa'}
        </Button>
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
                  Pesos Iniciales
                </h2>
                <p className="text-xs text-[var(--text-muted)] flex flex-wrap gap-x-3 gap-y-0.5 leading-relaxed">
                  {FIELDS.map((f) => (
                    <span key={f.key}>
                      {f.label.split(' (')[0]}: {initialWeights[f.key]}kg
                    </span>
                  ))}
                </p>
              </div>
              <Button variant="default" onClick={() => setIsExpanded(true)}>
                Editar Pesos
              </Button>
            </div>
          </div>

          {isExpanded && (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
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
        title="Actualizar Pesos Iniciales"
        message="Esto recalculará todo el programa con los nuevos pesos iniciales. Tu historial de éxitos/fallos se conservará, pero los pesos proyectados cambiarán. ¿Continuar?"
        confirmLabel="Actualizar Pesos"
        onConfirm={handleConfirmUpdate}
        onCancel={handleCancelUpdate}
      />
    </>
  );
}
