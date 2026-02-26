import { useState, type ReactNode } from 'react';
import { extractGenericChartData, calculateStats } from '@gzclp/shared/generic-stats';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import type { GenericWorkoutRow } from '@gzclp/shared/types';
import { LineChart } from './line-chart';

interface StatsPanelProps {
  readonly definition: ProgramDefinition;
  readonly rows: readonly GenericWorkoutRow[];
}

const UNCOVERED_GROUP_LABEL = 'Otros';

interface ExerciseGroup {
  readonly label: string | null;
  readonly exerciseIds: readonly string[];
}

function groupExercises(definition: ProgramDefinition): readonly ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  let pending: { label: string | null; ids: string[] } | null = null;

  for (const field of definition.configFields) {
    const label = field.group ?? null;
    if (!pending || pending.label !== label) {
      if (pending) groups.push({ label: pending.label, exerciseIds: pending.ids });
      pending = { label, ids: [field.key] };
    } else {
      pending.ids.push(field.key);
    }
  }
  if (pending) groups.push({ label: pending.label, exerciseIds: pending.ids });

  // Include any exercises not in configFields (fallback)
  const covered = new Set(definition.configFields.map((f) => f.key));
  const uncovered = Object.keys(definition.exercises).filter((id) => !covered.has(id));
  if (uncovered.length > 0) {
    groups.push({ label: UNCOVERED_GROUP_LABEL, exerciseIds: uncovered });
  }

  return groups;
}

function StatCard({
  name,
  currentWeight,
  startWeight,
  gained,
  currentStage,
  rate,
  successes,
  total,
}: {
  readonly name: string;
  readonly currentWeight: number;
  readonly startWeight: number;
  readonly gained: number;
  readonly currentStage: number;
  readonly rate: number;
  readonly successes: number;
  readonly total: number;
}): ReactNode {
  return (
    <div className="bg-[var(--bg-th)] border border-[var(--border-color)] p-4 card edge-glow-top">
      <h4 className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-2">
        {name}
      </h4>
      <div className="font-display-data text-3xl mb-1 text-[var(--text-header)]">
        {currentWeight} kg
      </div>
      <div className="text-xs text-[var(--text-muted)]">
        Inicio: {startWeight} kg | {gained >= 0 ? '+' : ''}
        {gained} kg ganados
        <br />
        Etapa {currentStage} | {rate}% éxito ({successes}/{total})
      </div>
    </div>
  );
}

function StatsPanel({ definition, rows }: StatsPanelProps): ReactNode {
  const chartData = extractGenericChartData(definition, rows);

  const groups = groupExercises(definition);

  const hasAnyResults = Object.values(chartData).some((series) =>
    series.some((d) => d.result !== null)
  );

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string): void => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!hasAnyResults) {
    return (
      <div className="text-center py-16">
        <p className="text-sm font-bold text-[var(--text-muted)] mb-2">Sin datos aún</p>
        <p className="text-xs text-[var(--text-muted)]">
          Completa tu primer entrenamiento para ver estadísticas y gráficas.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const sectionKey = group.label ?? '_ungrouped';
        const isOpen = openSections[sectionKey] ?? false;
        const exercisesWithData = group.exerciseIds.filter(
          (id) => chartData[id] && chartData[id].some((d) => d.result !== null)
        );

        if (exercisesWithData.length === 0) return null;

        return (
          <details
            key={sectionKey}
            open={isOpen}
            onToggle={() => toggleSection(sectionKey)}
            className="bg-[var(--bg-card)] border border-[var(--border-color)] overflow-hidden card"
          >
            <summary className="font-mono px-5 py-3.5 font-bold cursor-pointer select-none flex justify-between items-center [&::marker]:hidden list-none text-[11px] tracking-widest uppercase">
              {group.label ?? 'Ejercicios'}
              <span className="flex items-center gap-3">
                <span className="text-[var(--text-muted)] font-normal normal-case tracking-normal">
                  {exercisesWithData.length} ejercicio{exercisesWithData.length !== 1 ? 's' : ''}
                </span>
                <span className="transition-transform duration-200 [[open]>&]:rotate-90">
                  &#9656;
                </span>
              </span>
            </summary>
            <div className="px-5 pb-5 border-t border-[var(--border-light)]">
              {/* Summary cards */}
              <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mt-4 mb-4">
                {exercisesWithData.map((id) => {
                  const s = calculateStats(chartData[id]);
                  const name = definition.exercises[id].name;
                  return (
                    <StatCard
                      key={id}
                      name={name}
                      currentWeight={s.currentWeight}
                      startWeight={s.startWeight}
                      gained={s.gained}
                      currentStage={s.currentStage}
                      rate={s.rate}
                      successes={s.successes}
                      total={s.total}
                    />
                  );
                })}
              </div>

              {/* Charts — only render when section is open */}
              {isOpen && (
                <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1">
                  {exercisesWithData.map((id) => {
                    const name = definition.exercises[id].name;
                    return (
                      <div
                        key={id}
                        className="bg-[var(--bg-th)] border border-[var(--border-color)] p-4 card"
                      >
                        <h4 className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">
                          {name} — Progresión
                        </h4>
                        <LineChart data={chartData[id]} label={name} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}

export default StatsPanel;
