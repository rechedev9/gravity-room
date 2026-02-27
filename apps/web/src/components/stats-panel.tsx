import { useState, useRef, type ReactNode } from 'react';
import {
  extractGenericChartData,
  calculateStats,
  extractGenericRpeData,
  extractGenericAmrapData,
  extractWeeklyVolumeData,
} from '@gzclp/shared/generic-stats';
import type { ProgramDefinition } from '@gzclp/shared/types/program';
import type {
  GenericWorkoutRow,
  ChartDataPoint,
  RpeDataPoint,
  AmrapDataPoint,
} from '@gzclp/shared/types';
import { LineChart } from './line-chart';
import { VolumeChart } from './volume-chart';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const UNCOVERED_GROUP_LABEL = 'Otros';
const MIN_RPE_POINTS = 2;
const MIN_AMRAP_POINTS = 2;
const MIN_VOLUME_POINTS = 3;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface StatsPanelProps {
  readonly definition: ProgramDefinition;
  readonly rows: readonly GenericWorkoutRow[];
  readonly resultTimestamps: Readonly<Record<string, string>>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Convert RPE data points to ChartDataPoint[] for LineChart (numeric mode) */
function rpeToChartData(points: readonly RpeDataPoint[]): ChartDataPoint[] {
  return points.map((p) => ({
    workout: p.workout,
    weight: p.rpe,
    stage: 1,
    result: 'success' as const,
    date: p.date,
  }));
}

/** Convert AMRAP data points to ChartDataPoint[] for LineChart (numeric mode) */
function amrapToChartData(points: readonly AmrapDataPoint[]): ChartDataPoint[] {
  return points.map((p) => ({
    workout: p.workout,
    weight: p.reps,
    stage: 1,
    result: 'success' as const,
    date: p.date,
  }));
}

function sanitizeKey(key: string): string {
  return key.replace(/\s+/g, '_');
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

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

function CollapsibleSection({
  sectionKey,
  label,
  exerciseCount,
  isOpen,
  onToggle,
  children,
}: {
  readonly sectionKey: string;
  readonly label: string;
  readonly exerciseCount: number;
  readonly isOpen: boolean;
  readonly onToggle: () => void;
  readonly children: ReactNode;
}): ReactNode {
  const contentRef = useRef<HTMLDivElement>(null);
  const contentId = `section-${sanitizeKey(sectionKey)}-content`;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-color)] overflow-hidden card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="w-full font-mono px-5 py-3.5 font-bold cursor-pointer select-none flex justify-between items-center text-[11px] tracking-widest uppercase bg-transparent border-none text-inherit"
      >
        {label}
        <span className="flex items-center gap-3">
          <span className="text-[var(--text-muted)] font-normal normal-case tracking-normal">
            {exerciseCount} ejercicio{exerciseCount !== 1 ? 's' : ''}
          </span>
          <span
            className="transition-transform duration-200"
            style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
          >
            &#9656;
          </span>
        </span>
      </button>

      <div
        id={contentId}
        aria-hidden={!isOpen}
        className="transition-[max-height] duration-300 ease-in-out overflow-hidden"
        style={{ maxHeight: isOpen ? `${contentRef.current?.scrollHeight ?? 2000}px` : '0' }}
      >
        <div ref={contentRef} className="px-5 pb-5 border-t border-[var(--border-light)]">
          {children}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function StatsPanel({ definition, rows, resultTimestamps }: StatsPanelProps): ReactNode {
  const chartData = extractGenericChartData(definition, rows, resultTimestamps);
  const rpeData = extractGenericRpeData(definition, rows, resultTimestamps);
  const amrapData = extractGenericAmrapData(definition, rows, resultTimestamps);
  const volumeData = extractWeeklyVolumeData(rows, resultTimestamps);

  const groups = groupExercises(definition);

  const hasAnyResults = Object.values(chartData).some((series) =>
    series.some((d) => d.result !== null)
  );

  // Lazy-init: default the first exercise group with data to open
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    let firstSet = false;
    for (const group of groups) {
      const key = group.label ?? '_ungrouped';
      const hasData = group.exerciseIds.some(
        (id) => chartData[id] && chartData[id].some((d) => d.result !== null)
      );
      if (hasData && !firstSet) {
        initial[key] = true;
        firstSet = true;
      }
    }
    return initial;
  });

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

        // RPE exercises with enough data points in this group
        const rpeExercises = exercisesWithData.filter(
          (id) => rpeData[id] && rpeData[id].length >= MIN_RPE_POINTS
        );

        // AMRAP exercises with enough data points in this group
        const amrapExercises = exercisesWithData.filter(
          (id) => amrapData[id] && amrapData[id].length >= MIN_AMRAP_POINTS
        );

        return (
          <CollapsibleSection
            key={sectionKey}
            sectionKey={sectionKey}
            label={group.label ?? 'Ejercicios'}
            exerciseCount={exercisesWithData.length}
            isOpen={isOpen}
            onToggle={() => toggleSection(sectionKey)}
          >
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

            {/* Weight Progression Charts — only render when section is open */}
            {isOpen && (
              <>
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
                        <LineChart
                          data={chartData[id]}
                          label={name}
                          resultTimestamps={resultTimestamps}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* RPE Trend Charts */}
                {rpeExercises.length > 0 && (
                  <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1 mt-5">
                    {rpeExercises.map((id) => {
                      const name = definition.exercises[id].name;
                      return (
                        <div
                          key={`rpe-${id}`}
                          data-testid={`rpe-chart-${id}`}
                          className="bg-[var(--bg-th)] border border-[var(--border-color)] p-4 card"
                        >
                          <h4 className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">
                            {name} — RPE
                          </h4>
                          <LineChart
                            data={rpeToChartData(rpeData[id])}
                            label={`${name} RPE`}
                            mode="numeric"
                            yAxisLabel="RPE"
                            showAllPrs={false}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* AMRAP Trend Charts */}
                {amrapExercises.length > 0 && (
                  <div className="grid grid-cols-2 gap-5 max-[900px]:grid-cols-1 mt-5">
                    {amrapExercises.map((id) => {
                      const name = definition.exercises[id].name;
                      return (
                        <div
                          key={`amrap-${id}`}
                          data-testid={`amrap-chart-${id}`}
                          className="bg-[var(--bg-th)] border border-[var(--border-color)] p-4 card"
                        >
                          <h4 className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-3">
                            {name} — AMRAP (reps)
                          </h4>
                          <LineChart
                            data={amrapToChartData(amrapData[id])}
                            label={`${name} AMRAP`}
                            mode="numeric"
                            yAxisLabel="Reps"
                            showAllPrs={false}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </CollapsibleSection>
        );
      })}

      {/* Weekly Volume Section — standalone at the bottom */}
      {volumeData.length >= MIN_VOLUME_POINTS && (
        <CollapsibleSection
          sectionKey="volumen-total"
          label="Volumen Total"
          exerciseCount={volumeData.length}
          isOpen={openSections['volumen-total'] ?? false}
          onToggle={() => toggleSection('volumen-total')}
        >
          <div className="mt-4">
            <VolumeChart data={volumeData} label="Volumen por Sesión (kg)" />
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

export default StatsPanel;
