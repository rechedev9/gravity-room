import type { z } from 'zod/v4';
import type {
  ProgressionRuleSchema,
  StageDefinitionSchema,
} from '@gzclp/shared/schemas/program-definition';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import type { GenericWorkoutRow } from '@gzclp/shared/types';

type ProgressionRule = z.infer<typeof ProgressionRuleSchema>;
type StageDefinition = z.infer<typeof StageDefinitionSchema>;

/** Per-slot editor state used by the progression step. */
export interface SlotEditorState {
  readonly dayIndex: number;
  readonly slotIndex: number;
  readonly slotId: string;
  readonly exerciseName: string;
  readonly stages: readonly StageDefinition[];
  readonly onSuccess: ProgressionRule;
  readonly onMidStageFail: ProgressionRule;
  readonly onFinalStageFail: ProgressionRule;
  readonly onFinalStageSuccess: ProgressionRule | undefined;
  readonly onUndefined: ProgressionRule | undefined;
  readonly showAdvanced: boolean;
  readonly templateId: string;
}

/** Preview loading state. */
export type PreviewState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly rows: readonly GenericWorkoutRow[] }
  | { readonly status: 'error'; readonly message: string };

export type WizardStepId = 'basic-info' | 'days-exercises' | 'progression';

export interface WizardState {
  readonly currentStep: WizardStepId;
  readonly definitionId: string;
  readonly definition: ProgramDefinition;
  readonly isDirty: boolean;
  readonly isSaving: boolean;
}

export interface WizardStepProps {
  readonly definition: ProgramDefinition;
  readonly onUpdate: (partial: Partial<ProgramDefinition>) => void;
  readonly onNext: () => void;
  readonly onBack: () => void;
}

export interface DefinitionWizardProps {
  readonly definitionId: string;
  readonly onComplete: (definitionId: string) => void;
  readonly onCancel: () => void;
}

export interface ExercisePickerProps {
  readonly onSelect: (exercise: { readonly id: string; readonly name: string }) => void;
  readonly onClose: () => void;
}
