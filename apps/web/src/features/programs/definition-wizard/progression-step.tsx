import { useState, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ProgramDefinitionSchema } from '@gzclp/shared/schemas/program-definition';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import { previewDefinition } from '@/lib/api-functions';
import { Button } from '@/components/button';
import { PROGRESSION_TEMPLATES } from './progression-templates';
import { SlotCard } from './slot-card';
import { PreviewTable } from './preview-table';
import type { WizardStepProps, SlotEditorState, PreviewState } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of workout cycles that make up one full program. */
const PROGRAM_CYCLE_COUNT = 15;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildInitialSlots(definition: ProgramDefinition): readonly SlotEditorState[] {
  const slots: SlotEditorState[] = [];
  for (let di = 0; di < definition.days.length; di++) {
    const day = definition.days[di];
    for (let si = 0; si < day.slots.length; si++) {
      const slot = day.slots[si];
      const name = definition.exercises[slot.exerciseId]?.name ?? slot.exerciseId;
      const matchedTemplate = PROGRESSION_TEMPLATES.find(
        (t) => t.onSuccess.type === slot.onSuccess.type
      );
      slots.push({
        dayIndex: di,
        slotIndex: si,
        slotId: slot.id,
        exerciseName: name,
        stages: slot.stages,
        onSuccess: slot.onSuccess,
        onMidStageFail: slot.onMidStageFail,
        onFinalStageFail: slot.onFinalStageFail,
        onFinalStageSuccess: slot.onFinalStageSuccess,
        onUndefined: slot.onUndefined,
        showAdvanced: false,
        templateId: matchedTemplate?.id ?? 'linear',
      });
    }
  }
  return slots;
}

function applySlotsToDef(
  definition: ProgramDefinition,
  slots: readonly SlotEditorState[]
): Pick<ProgramDefinition, 'days' | 'totalWorkouts' | 'workoutsPerWeek'> {
  const updatedDays: ProgramDefinition['days'] = definition.days.map((day, di) => ({
    name: day.name,
    slots: day.slots.map((origSlot, si) => {
      const state = slots.find((s) => s.dayIndex === di && s.slotIndex === si);
      if (!state) return origSlot;
      return {
        ...origSlot,
        stages: [...state.stages],
        onSuccess: state.onSuccess,
        onMidStageFail: state.onMidStageFail,
        onFinalStageFail: state.onFinalStageFail,
        ...(state.onFinalStageSuccess ? { onFinalStageSuccess: state.onFinalStageSuccess } : {}),
        ...(state.onUndefined ? { onUndefined: state.onUndefined } : {}),
      };
    }),
  }));

  const cycleLength = updatedDays.length;
  const totalWorkouts = cycleLength * PROGRAM_CYCLE_COUNT;

  return {
    days: updatedDays,
    totalWorkouts,
    workoutsPerWeek: Math.min(cycleLength, 6),
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ProgressionStepExtraProps extends WizardStepProps {
  readonly onSaveAndStart: () => void;
  readonly onSaveDraft: () => void;
  readonly isSaving: boolean;
}

export function ProgressionStep({
  definition,
  onUpdate,
  onBack,
  onSaveAndStart,
  onSaveDraft,
  isSaving,
}: ProgressionStepExtraProps): React.ReactNode {
  const [slots, setSlots] = useState(() => buildInitialSlots(definition));
  const [previewState, setPreviewState] = useState<PreviewState>({ status: 'idle' });

  const currentDef = useMemo((): ProgramDefinition => {
    const partial = applySlotsToDef(definition, slots);
    return { ...definition, ...partial };
  }, [definition, slots]);

  const { handleSubmit } = useForm<ProgramDefinition>({
    resolver: zodResolver(ProgramDefinitionSchema),
    defaultValues: currentDef,
  });

  // Derived directly from state to avoid RHF's isValid starting false before any interaction.
  const isDefinitionValid = useMemo(
    () => ProgramDefinitionSchema.safeParse(currentDef).success,
    [currentDef]
  );

  const handleSlotChange = useCallback((updated: SlotEditorState): void => {
    setSlots((prev) =>
      prev.map((s) =>
        s.dayIndex === updated.dayIndex && s.slotIndex === updated.slotIndex ? updated : s
      )
    );
    // Reset a loaded preview — slot changes invalidate it
    setPreviewState((prev) => (prev.status === 'loaded' ? { status: 'idle' } : prev));
  }, []);

  const handlePreview = async (): Promise<void> => {
    setPreviewState({ status: 'loading' });
    try {
      const rows = await previewDefinition(currentDef);
      setPreviewState({ status: 'loaded', rows });
    } catch {
      setPreviewState({ status: 'error', message: 'Error al generar la vista previa' });
    }
  };

  const onSave = (startAfter: boolean): void => {
    void handleSubmit(() => {
      onUpdate(currentDef);
      if (startAfter) {
        onSaveAndStart();
      } else {
        onSaveDraft();
      }
    })();
  };

  const groupedByDay = new Map<number, SlotEditorState[]>();
  for (const slot of slots) {
    const list = groupedByDay.get(slot.dayIndex) ?? [];
    list.push(slot);
    groupedByDay.set(slot.dayIndex, list);
  }

  const isPreviewLoading = previewState.status === 'loading';

  return (
    <div className="space-y-4">
      {Array.from(groupedByDay.entries()).map(([dayIndex, daySlots]) => {
        const dayName = definition.days[dayIndex]?.name ?? `Dia ${dayIndex + 1}`;
        return (
          <div key={dayIndex}>
            <h4 className="text-xs font-bold text-zinc-400 mb-2">{dayName}</h4>
            <div className="space-y-3">
              {daySlots.map((slot, slotIdx) => (
                <SlotCard
                  key={`${slot.dayIndex}-${slot.slotIndex}`}
                  slot={slot}
                  onChange={handleSlotChange}
                  defaultOpen={dayIndex === 0 && slotIdx === 0}
                />
              ))}
            </div>
          </div>
        );
      })}

      {/* Preview section */}
      <div className="border-t border-zinc-700/50 pt-4 space-y-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void handlePreview()}
          disabled={isPreviewLoading || isSaving}
        >
          {isPreviewLoading ? 'Cargando...' : 'Vista previa'}
        </Button>

        {previewState.status === 'loaded' && <PreviewTable rows={previewState.rows} />}

        {previewState.status === 'error' && (
          <p className="text-xs text-red-400">{previewState.message}</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-col sm:flex-row justify-between gap-3 pt-4">
        <Button variant="ghost" onClick={onBack} disabled={isSaving}>
          Atras
        </Button>
        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={() => onSave(false)}
            disabled={isSaving || !isDefinitionValid}
          >
            {isSaving ? 'Guardando...' : 'Guardar borrador'}
          </Button>
          <Button
            variant="primary"
            onClick={() => onSave(true)}
            disabled={isSaving || !isDefinitionValid}
          >
            {isSaving ? 'Guardando...' : 'Guardar y empezar'}
          </Button>
        </div>
      </div>
    </div>
  );
}
