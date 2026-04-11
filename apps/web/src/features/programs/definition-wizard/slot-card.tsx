import { useState } from 'react';
import type { z } from 'zod/v4';
import type {
  ProgressionRuleSchema,
  StageDefinitionSchema,
} from '@gzclp/shared/schemas/program-definition';
import { PROGRESSION_TEMPLATES } from './progression-templates';
import { StageEditor } from './stage-editor';
import { RuleSelector } from './rule-selector';
import type { SlotEditorState } from './types';

type ProgressionRule = z.infer<typeof ProgressionRuleSchema>;
type StageDefinition = z.infer<typeof StageDefinitionSchema>;

interface SlotCardProps {
  readonly slot: SlotEditorState;
  readonly onChange: (updated: SlotEditorState) => void;
  readonly defaultOpen?: boolean;
}

const DEFAULT_RULE: ProgressionRule = { type: 'no_change' };

export function SlotCard({ slot, onChange, defaultOpen }: SlotCardProps): React.ReactNode {
  const [isOpen, setIsOpen] = useState(defaultOpen === true);
  const [showAdvanced, setShowAdvanced] = useState(slot.showAdvanced);

  const toggleOpen = (): void => setIsOpen((prev) => !prev);

  const updateField = <K extends keyof SlotEditorState>(
    field: K,
    value: SlotEditorState[K]
  ): void => {
    onChange({ ...slot, [field]: value });
  };

  const handleTemplateChange = (templateId: string): void => {
    const template = PROGRESSION_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;
    // Template overwrites stages + standard rules, NOT advanced rules
    onChange({
      ...slot,
      templateId,
      stages: template.defaultStages,
      onSuccess: template.onSuccess,
      onMidStageFail: template.onMidStageFail,
      onFinalStageFail: template.onFinalStageFail,
    });
  };

  const handleStagesChange = (stages: readonly StageDefinition[]): void => {
    updateField('stages', stages);
  };

  const handleAdvancedToggle = (): void => {
    const next = !showAdvanced;
    setShowAdvanced(next);
    onChange({ ...slot, showAdvanced: next });
  };

  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl overflow-hidden">
      {/* Accordion header */}
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full flex items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-zinc-700/30 transition-colors"
        aria-expanded={isOpen}
        aria-label={`${slot.exerciseName} — ${isOpen ? 'colapsar' : 'expandir'}`}
      >
        <span className="text-sm font-medium text-zinc-200">{slot.exerciseName}</span>
        <span className="text-zinc-500 text-xs">{isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Accordion body */}
      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-zinc-700/50">
          {/* Template quick-select */}
          <div className="pt-3">
            <label className="block text-2xs font-bold text-zinc-400 uppercase tracking-wide mb-1">
              Plantilla
            </label>
            <select
              value={slot.templateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none"
              aria-label={`Plantilla para ${slot.exerciseName}`}
            >
              {PROGRESSION_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Stage editor */}
          <StageEditor stages={slot.stages} onChange={handleStagesChange} />

          {/* Standard rule selectors */}
          <div className="space-y-3">
            <RuleSelector
              label="Al completar"
              rule={slot.onSuccess}
              onChange={(rule) => {
                if (rule) updateField('onSuccess', rule);
              }}
            />
            <RuleSelector
              label="Al fallar (etapa intermedia)"
              rule={slot.onMidStageFail}
              onChange={(rule) => {
                if (rule) updateField('onMidStageFail', rule);
              }}
            />
            <RuleSelector
              label="Al fallar (etapa final)"
              rule={slot.onFinalStageFail}
              onChange={(rule) => {
                if (rule) updateField('onFinalStageFail', rule);
              }}
            />
          </div>

          {/* Advanced toggle */}
          <div className="border-t border-zinc-700/50 pt-3">
            <button
              type="button"
              onClick={handleAdvancedToggle}
              className="text-2xs text-amber-400 hover:text-amber-300 cursor-pointer font-bold uppercase tracking-wide"
              aria-expanded={showAdvanced}
            >
              {showAdvanced ? '▼ Avanzado' : '▶ Avanzado'}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-3">
                {/* Ultra-advanced: onFinalStageSuccess + onUndefined */}
                <div className="bg-zinc-900/50 rounded-lg p-3 space-y-3">
                  <p className="text-2xs font-bold text-zinc-500 uppercase tracking-wide">
                    Ultra-avanzado
                  </p>
                  <RuleSelector
                    label="Al completar la ultima etapa"
                    rule={slot.onFinalStageSuccess ?? DEFAULT_RULE}
                    onChange={(rule) => updateField('onFinalStageSuccess', rule)}
                    optional
                    advanced
                  />
                  <RuleSelector
                    label="Sin resultado definido"
                    rule={slot.onUndefined ?? DEFAULT_RULE}
                    onChange={(rule) => updateField('onUndefined', rule)}
                    optional
                    advanced
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
