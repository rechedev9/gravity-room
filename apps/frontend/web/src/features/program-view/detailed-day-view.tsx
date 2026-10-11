import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { GenericSlotRow } from '@gzclp/domain/types';
import { CheckIcon, CrossIcon } from '@/components/glyph-icons';
import { useUnitPreference } from '@/hooks/use-unit-preference';
import { localizedExerciseName } from '@/lib/catalog-display';
import { cn } from '@/lib/cn';
import type { DayViewProps } from './day-view';
import { SlotCardShell } from './slot-card-shell';
import { SlotResultFooter } from './slot-result-footer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Represents a single row in the per-set table. */
interface SetTableRow {
  readonly setIndex: number;
  /** Label: "W1", "W2" for warm-ups; "1", "2", "3" for working sets. */
  readonly label: string;
  readonly plannedWeight: number | undefined;
  readonly plannedReps: number;
  readonly isAmrap: boolean;
  readonly isWarmup: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the set table rows for a slot.
 * Handles standard, prescription, GPP, and bodyweight slot types.
 */
export function buildSetRows(slot: GenericSlotRow): readonly SetTableRow[] {
  const isGpp = slot.isGpp === true;
  const isBodyweight = slot.isBodyweight === true;
  const noWeight = isGpp || isBodyweight;

  // Prescription slots: individual warm-up + working set rows
  if (slot.prescriptions !== undefined && slot.prescriptions.length > 0) {
    const rows: SetTableRow[] = [];
    let globalIndex = 0;
    let warmupCount = 0;
    let workingCount = 0;

    const prescriptions = slot.prescriptions;
    const lastPrescriptionIndex = prescriptions.length - 1;

    for (let pIdx = 0; pIdx < prescriptions.length; pIdx++) {
      const entry = prescriptions[pIdx];
      const isWarmup = pIdx < lastPrescriptionIndex;
      const setCount = entry.sets;

      for (let s = 0; s < setCount; s++) {
        const isLastGlobal = pIdx === lastPrescriptionIndex && s === setCount - 1;
        const label = isWarmup ? `W${++warmupCount}` : `${++workingCount}`;

        rows.push({
          setIndex: globalIndex++,
          label,
          plannedWeight: noWeight ? undefined : entry.weight,
          plannedReps: entry.reps,
          isAmrap: slot.isAmrap && isLastGlobal,
          isWarmup,
        });
      }
    }

    return rows;
  }

  // Standard / GPP / bodyweight slots
  const rows: SetTableRow[] = [];
  for (let i = 0; i < slot.sets; i++) {
    rows.push({
      setIndex: i,
      label: `${i + 1}`,
      plannedWeight: noWeight ? undefined : slot.weight,
      plannedReps: slot.reps,
      isAmrap: slot.isAmrap && i === slot.sets - 1,
      isWarmup: false,
    });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Set rows of one slot
// ---------------------------------------------------------------------------

const FIELD_CLASS =
  'flex h-11 min-w-0 items-center gap-1.5 rounded-control border border-rule bg-body px-3 transition-colors duration-[var(--duration-press)] focus-within:border-accent';
const INPUT_CLASS =
  'w-full min-w-0 bg-transparent text-base text-main tabular-nums placeholder:text-label [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:cursor-not-allowed';

/** Reads a typed number; an empty or malformed field is no number at all. */
function parseField(text: string): number | undefined {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(value) || value < 0 ? undefined : value;
}

interface SlotSetsProps {
  readonly slot: GenericSlotRow;
  readonly workoutIndex: number;
  readonly focal: boolean;
  readonly onSetTap?: DayViewProps['onSetTap'];
  readonly onMark: DayViewProps['onMark'];
  readonly onUndo: DayViewProps['onUndo'];
  readonly onSetAmrapReps: DayViewProps['onSetAmrapReps'];
  readonly onSetRpe?: DayViewProps['onSetRpe'];
  readonly getSetLogs?: DayViewProps['getSetLogs'];
  readonly isSlotLogging?: DayViewProps['isSlotLogging'];
}

function SlotSets({
  slot,
  workoutIndex,
  focal,
  onSetTap,
  onMark,
  onUndo,
  onSetAmrapReps,
  onSetRpe,
  getSetLogs,
  isSlotLogging,
}: SlotSetsProps): ReactNode {
  const { t } = useTranslation();
  const { unit, toDisplay, fromDisplay, format } = useUnitPreference();
  const isDone = slot.result !== undefined;
  const noWeight = slot.isGpp === true || slot.isBodyweight === true;
  const exerciseLabel = localizedExerciseName(t, slot.exerciseId, slot.exerciseName);

  const setRows = buildSetRows(slot);

  // In-progress logs win over the committed ones while the slot is still open.
  const displayLogs = getSetLogs?.(workoutIndex, slot.slotId) ?? slot.setLogs;
  const logging = isSlotLogging?.(workoutIndex, slot.slotId) === true;
  const confirmedCount = displayLogs?.length ?? 0;

  // Typed text stays local until the set is confirmed; untouched fields follow the plan.
  const [repsEdits, setRepsEdits] = useState<Readonly<Record<number, string>>>({});
  const [weightEdits, setWeightEdits] = useState<Readonly<Record<number, string>>>({});

  const repsText = (row: SetTableRow): string => repsEdits[row.setIndex] ?? String(row.plannedReps);
  const weightText = (row: SetTableRow): string =>
    weightEdits[row.setIndex] ??
    (row.plannedWeight === undefined ? '' : String(toDisplay(row.plannedWeight)));

  /** What confirming this row would record, or null while a field is not a usable number. */
  const entryFor = (row: SetTableRow): { reps: number; weight: number | undefined } | null => {
    const reps = parseField(repsText(row));
    if (reps === undefined || !Number.isInteger(reps)) return null;
    if (noWeight) return { reps, weight: row.plannedWeight };
    const edited = weightEdits[row.setIndex];
    // An untouched load is recorded exactly as planned, with no unit round trip.
    if (edited === undefined) return { reps, weight: row.plannedWeight };
    const shown = parseField(edited);
    return shown === undefined ? null : { reps, weight: fromDisplay(shown) };
  };

  const confirmSet = (row: SetTableRow): void => {
    const entry = entryFor(row);
    if (!onSetTap || entry === null) return;
    onSetTap(workoutIndex, slot.slotId, row.setIndex, entry.reps, entry.weight);
  };

  const confirmOnEnter = (event: KeyboardEvent<HTMLInputElement>, row: SetTableRow): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    confirmSet(row);
  };

  // A slot marked straight from the footer has no per-set logs: the prescribed sets still
  // show, coloured by the slot result, instead of collapsing to nothing.
  const doneWithoutLogs = isDone && confirmedCount === 0;
  const slotSucceeded = slot.result === 'success';
  const columns = noWeight
    ? 'grid-cols-[1.75rem_minmax(0,1fr)_2.75rem]'
    : 'grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)_2.75rem]';

  return (
    <SlotCardShell slot={slot} focal={focal}>
      <div
        data-testid="slot-set-table"
        role="group"
        aria-label={t('tracker.detailed_day_view.table_aria', { exercise: exerciseLabel })}
        className="flex flex-col gap-2"
      >
        <div
          aria-hidden="true"
          className={cn('grid gap-2 font-mono text-xs font-bold text-label', columns)}
        >
          <span />
          {!noWeight && <span className="pl-1">{unit}</span>}
          <span className="pl-1">{t('tracker.detailed_day_view.col_reps')}</span>
          <span />
        </div>

        {setRows.map((row, rowIndex) => {
          const log = displayLogs?.[rowIndex];
          const isNext = rowIndex === confirmedCount && !isDone;
          const resolved = log !== undefined || doneWithoutLogs;
          if (isDone && !resolved) return null;

          const met = log !== undefined ? log.reps >= row.plannedReps : slotSucceeded;
          const tone = met ? 'text-ok' : 'text-fail';
          const label = (
            <span
              className={cn(
                'font-mono text-sm tabular-nums',
                row.isWarmup ? 'text-label italic' : 'text-muted'
              )}
            >
              {row.label}
              {row.isAmrap && <span className="font-bold text-accent">+</span>}
            </span>
          );

          if (resolved) {
            const loggedKg = log?.weight ?? row.plannedWeight;
            return (
              <div
                key={row.setIndex}
                data-set-state={met ? 'met' : 'missed'}
                className={cn('grid min-h-9 items-center gap-2', columns)}
              >
                {label}
                {!noWeight && (
                  <span className="pl-1 text-[15px] text-muted tabular-nums">
                    {loggedKg === undefined ? '' : format(loggedKg)}
                  </span>
                )}
                <span className={cn('pl-1 text-[15px] tabular-nums', tone)}>
                  {t('tracker.detailed_day_view.logged_reps', {
                    reps: log?.reps ?? row.plannedReps,
                  })}
                </span>
                <span
                  role="img"
                  aria-label={t(
                    met
                      ? 'tracker.detailed_day_view.set_completed_aria'
                      : 'tracker.detailed_day_view.set_failed_aria'
                  )}
                  className={cn(
                    'flex justify-center',
                    tone,
                    log !== undefined &&
                      !isDone &&
                      'animate-[pop-in_0.2s_cubic-bezier(0.16,1,0.3,1)]'
                  )}
                >
                  {met ? <CheckIcon size={22} /> : <CrossIcon size={22} />}
                </span>
              </div>
            );
          }

          const entry = isNext ? entryFor(row) : null;
          return (
            <div
              key={row.setIndex}
              data-set-state={isNext ? 'next' : 'queued'}
              className={cn('grid items-center gap-2', columns, !isNext && 'opacity-45')}
            >
              {label}
              {!noWeight && (
                <label className={FIELD_CLASS}>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    min={0}
                    value={weightText(row)}
                    onChange={(e) =>
                      setWeightEdits((prev) => ({ ...prev, [row.setIndex]: e.target.value }))
                    }
                    onFocus={(e) => e.target.select()}
                    onKeyDown={(e) => confirmOnEnter(e, row)}
                    disabled={!isNext}
                    aria-label={t('tracker.detailed_day_view.weight_input_aria', {
                      label: row.label,
                    })}
                    className={INPUT_CLASS}
                    style={{ outline: 'none' }}
                  />
                </label>
              )}
              <label className={FIELD_CLASS}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={repsText(row)}
                  onChange={(e) =>
                    setRepsEdits((prev) => ({ ...prev, [row.setIndex]: e.target.value }))
                  }
                  onFocus={(e) => e.target.select()}
                  onKeyDown={(e) => confirmOnEnter(e, row)}
                  disabled={!isNext}
                  placeholder={String(row.plannedReps)}
                  aria-label={t('tracker.detailed_day_view.reps_input_aria', { label: row.label })}
                  className={INPUT_CLASS}
                  style={{ outline: 'none' }}
                />
                <span aria-hidden="true" className="shrink-0 font-mono text-xs text-label">
                  / {row.plannedReps}
                  {row.isAmrap ? '+' : ''}
                </span>
              </label>
              <button
                type="button"
                onClick={() => confirmSet(row)}
                disabled={!isNext || entry === null}
                aria-label={t('tracker.detailed_day_view.confirm_set_aria', { label: row.label })}
                style={isNext ? { boxShadow: 'var(--shadow-pressed-steel)' } : undefined}
                className={cn(
                  'flex size-11 items-center justify-center rounded-control cursor-pointer',
                  'transition-[transform,background-color] duration-[var(--duration-press)] ease-[var(--ease-press)] active:translate-y-px',
                  'disabled:cursor-not-allowed',
                  isNext
                    ? 'bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-45'
                    : 'border border-rule text-label'
                )}
              >
                <CheckIcon size={22} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Set-first mode: the footer only carries undo, AMRAP and RPE. */}
      <SlotResultFooter
        slot={slot}
        workoutIndex={workoutIndex}
        isLogging={logging}
        setFirstMode
        onMark={onMark}
        onUndo={onUndo}
        onSetAmrapReps={onSetAmrapReps}
        onSetRpe={onSetRpe}
      />
    </SlotCardShell>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function DetailedDayView({
  workout,
  isCurrent,
  onMark,
  onUndo,
  onSetAmrapReps,
  onSetRpe,
  onSetTap,
  getSetLogs,
  isSlotLogging,
}: DayViewProps): ReactNode {
  const { t } = useTranslation();
  const nextSlotId = isCurrent ? workout.slots.find((s) => s.result === undefined)?.slotId : null;
  return (
    <div
      data-testid="detailed-day-grid"
      className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 xl:grid-cols-3"
      aria-label={t('tracker.detailed_day_view.workout_aria', { number: workout.index + 1 })}
    >
      {workout.slots.map((slot) => (
        <SlotSets
          key={slot.slotId}
          slot={slot}
          workoutIndex={workout.index}
          focal={slot.slotId === nextSlotId}
          onSetTap={onSetTap}
          onMark={onMark}
          onUndo={onUndo}
          onSetAmrapReps={onSetAmrapReps}
          onSetRpe={onSetRpe}
          getSetLogs={getSetLogs}
          isSlotLogging={isSlotLogging}
        />
      ))}
    </div>
  );
}
