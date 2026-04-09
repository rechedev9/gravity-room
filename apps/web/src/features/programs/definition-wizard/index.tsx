import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ProgramDefinitionSchema } from '@gzclp/shared/schemas/program-definition';
import { isRecord } from '@gzclp/shared/type-guards';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { queryKeys } from '@/lib/query-keys';
import { fetchDefinition, updateDefinition, createCustomProgram } from '@/lib/api-functions';
import { BasicInfoStep } from './basic-info-step';
import { DaysAndExercisesStep } from './days-exercises-step';
import { ProgressionStep } from './progression-step';
import type { DefinitionWizardProps, WizardStepId } from './types';

const STEPS: readonly WizardStepId[] = ['basic-info', 'days-exercises', 'progression'];

const STEP_LABELS: Readonly<Record<WizardStepId, string>> = {
  'basic-info': 'Informacion basica',
  'days-exercises': 'Dias y ejercicios',
  progression: 'Progresion',
};

function parseDefinition(raw: unknown): ProgramDefinition | null {
  if (!isRecord(raw)) return null;
  const result = ProgramDefinitionSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export function DefinitionWizard({
  definitionId,
  onComplete,
  onCancel,
}: DefinitionWizardProps): React.ReactNode {
  const [currentStep, setCurrentStep] = useState<WizardStepId>('basic-info');
  const [draft, setDraft] = useState<ProgramDefinition | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defQuery = useQuery({
    queryKey: queryKeys.definitions.detail(definitionId),
    queryFn: () => fetchDefinition(definitionId),
    staleTime: 30_000,
  });

  // Derive the working definition: user's unsaved edits take precedence over server state.
  // If draft is null, fall back to the parsed query data (no edits yet).
  const serverDef = defQuery.data ? parseDefinition(defQuery.data.definition) : null;
  const workingDef = draft ?? serverDef;
  const isDirty = draft !== null;

  const handleUpdate = useCallback(
    (partial: Partial<ProgramDefinition>): void => {
      setDraft((prev): ProgramDefinition | null => {
        const base = prev ?? serverDef;
        if (!base) return prev;
        return { ...base, ...partial };
      });
    },
    [serverDef]
  );

  const stepIndex = STEPS.indexOf(currentStep);

  const handleNext = (): void => {
    if (stepIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[stepIndex + 1]);
    }
  };

  const handleBack = (): void => {
    if (stepIndex > 0) {
      setCurrentStep(STEPS[stepIndex - 1]);
    } else {
      onCancel();
    }
  };

  const handleSaveAndStart = async (): Promise<void> => {
    if (!workingDef) return;
    setIsSaving(true);
    setError(null);
    try {
      await updateDefinition(definitionId, workingDef);
      // Create a program instance from this definition
      const defaultConfig: Record<string, number | string> = {};
      for (const field of workingDef.configFields) {
        if (field.type === 'weight') {
          defaultConfig[field.key] = field.min;
        }
      }
      await createCustomProgram(definitionId, workingDef.name, defaultConfig);
      onComplete(definitionId);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al guardar';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveDraft = async (): Promise<void> => {
    if (!workingDef) return;
    setIsSaving(true);
    setError(null);
    try {
      await updateDefinition(definitionId, workingDef);
      setDraft(null);
      onCancel();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Error al guardar';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  if (defQuery.isLoading) {
    return (
      <div className="fixed inset-0 bg-zinc-950/95 z-50 flex items-center justify-center">
        <p className="text-sm text-zinc-400">Cargando definicion...</p>
      </div>
    );
  }

  if (!workingDef) {
    return (
      <div className="fixed inset-0 bg-zinc-950/95 z-50 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-sm text-zinc-400 mb-4">
            No se pudo cargar la definicion del programa.
          </p>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer transition-colors"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-zinc-950/95 z-50 overflow-y-auto">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-zinc-100">Editar programa</h2>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer transition-colors"
          >
            Cerrar
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  i === stepIndex
                    ? 'bg-amber-500 text-zinc-900'
                    : i < stepIndex
                      ? 'bg-amber-500/30 text-amber-400'
                      : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                {i + 1}
              </div>
              <span
                className={`text-xs hidden sm:inline ${
                  i === stepIndex ? 'text-zinc-200 font-medium' : 'text-zinc-500'
                }`}
              >
                {STEP_LABELS[step]}
              </span>
              {i < STEPS.length - 1 && <div className="w-8 h-px bg-zinc-700" />}
            </div>
          ))}
        </div>

        <p className="text-xs text-zinc-500 mb-6">
          Paso {stepIndex + 1} de {STEPS.length}
          {isDirty && ' — cambios sin guardar'}
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 mb-4">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* Step content */}
        {currentStep === 'basic-info' && (
          <BasicInfoStep
            definition={workingDef}
            onUpdate={handleUpdate}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === 'days-exercises' && (
          <DaysAndExercisesStep
            definition={workingDef}
            onUpdate={handleUpdate}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        {currentStep === 'progression' && (
          <ProgressionStep
            definition={workingDef}
            onUpdate={handleUpdate}
            onNext={handleNext}
            onBack={handleBack}
            onSaveAndStart={() => void handleSaveAndStart()}
            onSaveDraft={() => void handleSaveDraft()}
            isSaving={isSaving}
          />
        )}
      </div>
    </div>
  );
}
