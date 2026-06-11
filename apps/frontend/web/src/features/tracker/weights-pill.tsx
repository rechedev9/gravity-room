import type { ProgramDefinition } from '@gzclp/domain/types/program';

interface WeightsPillProps {
  readonly definition: ProgramDefinition;
  readonly config: Record<string, number | string>;
  readonly onEdit: () => void;
}

/** Build a compact summary string: "Sentadilla 80 · Press Banca 55 · +2" */
function buildWeightsSummary(
  config: Record<string, number | string>,
  fields: ProgramDefinition['configFields']
): string {
  const weightFields = fields.filter((f) => f.type === 'weight');
  const shown = weightFields.slice(0, 4);
  const overflow = weightFields.length - 4;
  const parts = shown.map((f) => {
    const val = config[f.key];
    return val !== undefined ? `${f.label} ${val}` : f.label;
  });
  if (overflow > 0) parts.push(`+${overflow}`);
  return parts.join(' · ');
}

export function WeightsPill({ definition, config, onEdit }: WeightsPillProps): React.ReactNode {
  const summary = buildWeightsSummary(config, definition.configFields);
  return (
    <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6 px-3 py-2 bg-card border border-rule rounded-[var(--radius-base)]">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted mb-0.5">
          PESOS DE INICIO
        </p>
        <p className="font-mono text-xs text-muted truncate">{summary || '—'}</p>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="font-mono text-[10px] text-accent uppercase tracking-widest hover:brightness-110 px-3 py-2 shrink-0 border-[1.5px] border-accent rounded-[var(--radius-base)]"
      >
        editar
      </button>
    </div>
  );
}
