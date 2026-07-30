import type { ProgramDefinition } from '@gzclp/domain/types/program';
import { useTranslation } from 'react-i18next';

interface WeightsPillProps {
  readonly definition: ProgramDefinition;
  readonly config: Record<string, number | string>;
  readonly onEdit: () => void;
}

/** Build a compact summary string: "Sentadilla 80 · Press Banca 55 · +2 more" */
export function buildWeightsSummary(
  config: Record<string, number | string>,
  fields: ProgramDefinition['configFields'],
  overflowLabel: (n: number) => string
): string {
  const weightFields = fields.filter((f) => f.type === 'weight');
  const shown = weightFields.slice(0, 4);
  const overflow = weightFields.length - 4;
  const parts = shown.map((f) => {
    const val = config[f.key];
    return val !== undefined ? `${f.label} ${val}` : f.label;
  });
  if (overflow > 0) parts.push(overflowLabel(overflow));
  return parts.join(' · ');
}

export function WeightsPill({ definition, config, onEdit }: WeightsPillProps): React.ReactNode {
  const { t } = useTranslation();
  const summary = buildWeightsSummary(config, definition.configFields, (n) =>
    t('tracker.setup_form.overflow_indicator', { n })
  );
  return (
    <div
      data-testid="weights-pill"
      className="flex items-center justify-between gap-3 mb-4 sm:mb-6 px-3 py-2 bg-card border border-rule rounded-[var(--radius-base)]"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-0.5">
          {t('tracker.setup_form.collapsed_title')}
        </p>
        <p className="font-mono text-xs text-muted truncate">{summary || '—'}</p>
      </div>
      {/* Secondary action: outline on the rule ladder, not gold (gold is scarce). */}
      <button
        type="button"
        onClick={onEdit}
        data-testid="weights-pill-edit"
        className="font-mono text-[10px] text-muted uppercase tracking-widest hover:text-main hover:border-rule-light px-3 py-2 shrink-0 border-[1.5px] border-rule rounded-[var(--radius-base)] transition-colors"
      >
        {t('tracker.setup_form.edit_button_short')}
      </button>
    </div>
  );
}
