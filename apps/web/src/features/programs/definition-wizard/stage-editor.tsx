import { useTranslation } from 'react-i18next';
import type { z } from 'zod/v4';
import type { StageDefinitionSchema } from '@gzclp/shared/schemas/program-definition';

type StageDefinition = z.infer<typeof StageDefinitionSchema>;

const MIN_SETS = 1;
const MAX_SETS = 20;
const MIN_REPS = 1;
const MAX_REPS = 100;
const DEFAULT_STAGE: StageDefinition = { sets: 3, reps: 5, amrap: false };

interface StageEditorProps {
  readonly stages: readonly StageDefinition[];
  readonly onChange: (stages: readonly StageDefinition[]) => void;
}

export function StageEditor({ stages, onChange }: StageEditorProps): React.ReactNode {
  const { t } = useTranslation();
  const canRemove = stages.length > 1;

  const updateStage = (
    index: number,
    field: keyof StageDefinition,
    value: number | boolean
  ): void => {
    if (field === 'sets' && typeof value === 'number' && (value < MIN_SETS || value > MAX_SETS)) {
      return;
    }
    if (field === 'reps' && typeof value === 'number' && (value < MIN_REPS || value > MAX_REPS)) {
      return;
    }
    const updated = stages.map((stage, i) => {
      if (i !== index) return stage;
      const next = { ...stage, [field]: value };
      // Clear repsMax when amrap is turned off
      if (field === 'amrap' && value === false) {
        return { sets: next.sets, reps: next.reps, amrap: false };
      }
      return next;
    });
    onChange(updated);
  };

  const addStage = (): void => {
    onChange([...stages, DEFAULT_STAGE]);
  };

  const removeStage = (index: number): void => {
    if (!canRemove) return;
    onChange(stages.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <p className="text-2xs font-bold text-zinc-400 uppercase tracking-wide">
        {t('programs.wizard.stage_editor.title')}
      </p>
      {stages.map((stage, i) => (
        <div key={i} className="flex items-center gap-2 bg-zinc-900/50 rounded-lg p-2">
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="block text-2xs text-zinc-500 mb-0.5">
                {t('programs.wizard.stage_editor.fields.sets')}
              </label>
              <input
                type="number"
                min={MIN_SETS}
                max={MAX_SETS}
                value={stage.sets}
                onChange={(e) => updateStage(i, 'sets', Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none text-center"
                aria-label={`${t('programs.wizard.stage_editor.fields.sets')} ${i + 1}`}
              />
            </div>
            <div>
              <label className="block text-2xs text-zinc-500 mb-0.5">
                {t('programs.wizard.stage_editor.fields.reps')}
              </label>
              <input
                type="number"
                min={MIN_REPS}
                max={MAX_REPS}
                value={stage.reps}
                onChange={(e) => updateStage(i, 'reps', Number(e.target.value))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none text-center"
                aria-label={`${t('programs.wizard.stage_editor.fields.reps')} ${i + 1}`}
              />
            </div>
            <div className="flex items-end gap-1.5">
              <label className="flex items-center gap-1 text-2xs text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={stage.amrap === true}
                  onChange={(e) => updateStage(i, 'amrap', e.target.checked)}
                  className="accent-amber-500"
                  aria-label={`AMRAP ${i + 1}`}
                />
                AMRAP
              </label>
            </div>
            {stage.amrap && (
              <div>
                <label className="block text-2xs text-zinc-500 mb-0.5">
                  {t('programs.wizard.stage_editor.fields.reps_max')}
                </label>
                <input
                  type="number"
                  min={1}
                  value={stage.repsMax ?? ''}
                  onChange={(e) => updateStage(i, 'repsMax', Number(e.target.value))}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none text-center"
                  aria-label={`${t('programs.wizard.stage_editor.fields.reps_max')} ${i + 1}`}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => removeStage(i)}
            disabled={!canRemove}
            className="text-2xs text-red-400 hover:text-red-300 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer px-1"
            aria-label={`${t('programs.wizard.stage_editor.remove_stage')} ${i + 1}`}
          >
            {t('programs.wizard.stage_editor.remove_stage')}
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addStage}
        className="text-2xs text-amber-400 hover:text-amber-300 cursor-pointer"
      >
        {t('programs.wizard.stage_editor.add_stage')}
      </button>
    </div>
  );
}
