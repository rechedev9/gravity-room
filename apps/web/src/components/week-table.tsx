import { Fragment, useMemo, useEffect, useRef } from 'react';
import type { ResultValue, GenericWorkoutRow, GenericSlotRow } from '@gzclp/shared/types';
import { ResultCell } from './result-cell';
import { AmrapInput } from './amrap-input';
import { RPE_VALUES } from './rpe-input';
import { StageTag } from './stage-tag';

interface WeekTableProps {
  readonly weekRows: readonly GenericWorkoutRow[];
  readonly firstPendingIndex: number;
  readonly onMark: (workoutIndex: number, slotKey: string, value: ResultValue) => void;
  readonly onUndo: (workoutIndex: number, slotKey: string) => void;
  readonly onSetAmrapReps: (
    workoutIndex: number,
    slotKey: string,
    reps: number | undefined
  ) => void;
  readonly onSetRpe?: (workoutIndex: number, slotKey: string, rpe: number | undefined) => void;
}

/** Compact RPE selector for table cells — replaces the 5-button pill strip. */
function RpeSelect({
  value,
  onChange,
  workoutIndex,
  slotKey,
}: {
  readonly value: number | undefined;
  readonly onChange: (rpe: number | undefined) => void;
  readonly workoutIndex: number;
  readonly slotKey: string;
}): React.ReactNode {
  return (
    <select
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v ? Number(v) : undefined);
      }}
      data-rpe-input={`${workoutIndex}-${slotKey}`}
      aria-label="RPE"
      className="bg-card text-main border border-rule text-xs font-bold px-1.5 py-1.5 min-h-[36px] min-w-[52px] cursor-pointer rounded-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    >
      <option value="">{'\u2014'}</option>
      {RPE_VALUES.map((v) => (
        <option key={v} value={v}>
          {v}
        </option>
      ))}
    </select>
  );
}

const TH =
  'text-left font-mono text-[11px] font-bold uppercase tracking-widest text-muted px-2.5 py-2 whitespace-nowrap border border-rule';
const TD = 'px-2.5 py-2 border border-rule-light';

/** Render prescription ladder: warm-ups -> working set separated by | */
function renderPrescriptionScheme(slot: GenericSlotRow): React.ReactNode {
  const prescriptions = slot.prescriptions;
  if (prescriptions === undefined || prescriptions.length === 0) {
    return null;
  }

  const warmups = prescriptions.slice(0, -1);
  const workingSet = prescriptions[prescriptions.length - 1];

  return (
    <span className="text-[11px]">
      {warmups.map((entry, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="text-muted mx-0.5">{'\u2192'}</span>}
          <span className="text-muted">
            {`${entry.percent}%\u00d7${slot.complexReps ?? entry.reps}`}
          </span>
        </Fragment>
      ))}
      {warmups.length > 0 && <span className="text-muted mx-1">|</span>}
      <span className="font-bold text-main">
        {`${workingSet.percent}%\u00d7${slot.complexReps ?? workingSet.reps}\u00d7${workingSet.sets}`}
      </span>
    </span>
  );
}

/** Render standard scheme: sets x reps with optional range and AMRAP indicator */
function renderStandardScheme(slot: GenericSlotRow): React.ReactNode {
  return (
    <>
      {slot.sets}
      {'\u00d7'}
      {slot.complexReps ?? slot.reps}
      {slot.repsMax !== undefined ? `\u2013${slot.repsMax}` : ''}
      {slot.isAmrap && <span className="text-[10px] ml-0.5 text-accent">+</span>}
    </>
  );
}

export function WeekTable({
  weekRows,
  firstPendingIndex,
  onMark,
  onUndo,
  onSetAmrapReps,
  onSetRpe,
}: WeekTableProps): React.ReactNode {
  // Derive column visibility from the current week's data
  const { showStage, showAmrap, showRpe, colCount } = useMemo(() => {
    const allSlots = weekRows.flatMap((r) => r.slots);
    // Exclude prescription and GPP slots from stage check — they never have meaningful stages
    const stage = allSlots.some(
      (s) => s.stagesCount > 1 && s.prescriptions === undefined && !s.isGpp
    );
    const amrap = allSlots.some((s) => s.isAmrap);
    const rpe = allSlots.some((s) => s.role === 'primary');
    // 4 always-visible: Tier + Ejercicio + Peso + Esquema
    // 1 always-visible: Resultado
    const count = 5 + (stage ? 1 : 0) + (amrap ? 1 : 0) + (rpe ? 1 : 0);
    return { showStage: stage, showAmrap: amrap, showRpe: rpe, colCount: count };
  }, [weekRows]);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const updateShadows = (): void => {
      const { scrollLeft, scrollWidth, clientWidth } = el;
      el.dataset['scrollLeft'] = String(scrollLeft > 0);
      el.dataset['scrollRight'] = String(scrollLeft < scrollWidth - clientWidth - 1);
    };

    updateShadows();
    el.addEventListener('scroll', updateShadows, { passive: true });
    return (): void => {
      el.removeEventListener('scroll', updateShadows);
    };
  }, [weekRows]);

  return (
    <div ref={scrollRef} className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0 table-scroll-shadow">
      <table className="w-full border-collapse min-w-[680px]">
        <thead>
          <tr>
            <th className={TH}>Tier</th>
            <th className={TH}>Ejercicio</th>
            <th className={`${TH} text-right`}>Peso</th>
            <th className={`${TH} text-center`}>Esquema</th>
            {showStage && <th className={`${TH} text-center`}>Etapa</th>}
            <th className={`${TH} text-center`}>Resultado</th>
            {showAmrap && <th className={`${TH} text-center`}>AMRAP</th>}
            {showRpe && <th className={`${TH} text-center`}>RPE</th>}
          </tr>
        </thead>
        <tbody>
          {weekRows.map((row) => {
            const isComplete = row.slots.every((s) => s.result !== undefined);
            const isCurrent = row.index === firstPendingIndex;

            return (
              <Fragment key={row.index}>
                {/* Day group header */}
                <tr
                  className={`${isCurrent ? 'bg-[rgba(232,170,32,0.06)]' : ''}`}
                  {...(isCurrent ? { 'data-current-row': true } : {})}
                >
                  <td
                    colSpan={colCount}
                    className="px-2.5 py-2 font-mono text-[12px] font-bold tracking-wider border border-rule"
                  >
                    <span className="text-title">#{row.index + 1}</span>
                    <span className="text-muted mx-2">{'\u2014'}</span>
                    <span className="text-main uppercase">{row.dayName}</span>
                    <span className="ml-3 text-sm">
                      {isComplete ? (
                        <span className="text-accent">{'\u25CF'}</span>
                      ) : (
                        <span className="text-info">{'\u25CB'}</span>
                      )}
                    </span>
                  </td>
                </tr>

                {/* Exercise rows */}
                {row.slots.map((slot) => {
                  const isDone = slot.result !== undefined;
                  const needsAmrap =
                    slot.result === 'success' && slot.isAmrap && slot.amrapReps === undefined;
                  const fullyDone = isDone && !needsAmrap;
                  const slotShowRpe = slot.role === 'primary';

                  return (
                    <tr
                      key={slot.slotId}
                      className={`transition-opacity duration-200 even:bg-[rgba(255,255,255,0.02)] ${
                        fullyDone ? 'opacity-70' : ''
                      } ${isCurrent && !fullyDone ? 'bg-[rgba(232,170,32,0.03)]' : ''} ${
                        slot.isChanged && !isDone ? 'bg-changed' : ''
                      }`}
                    >
                      {/* Tier */}
                      <td
                        className={`${TD} text-[11px] font-bold uppercase whitespace-nowrap ${
                          slot.role === 'primary'
                            ? 'text-accent'
                            : slot.role === 'secondary'
                              ? 'text-main'
                              : 'text-muted'
                        }`}
                      >
                        {slot.tier.toUpperCase()}
                      </td>

                      {/* Exercise name */}
                      <td className={`${TD} font-bold text-[13px] truncate max-w-[200px]`}>
                        {slot.exerciseName}
                      </td>

                      {/* Weight */}
                      <td
                        className={`${TD} text-right tabular-nums whitespace-nowrap font-bold text-[13px]`}
                      >
                        {slot.prescriptions !== undefined && !slot.isGpp ? (
                          <>
                            {`${slot.weight} kg`}
                            <span className="block text-[10px] text-muted">
                              {`(${slot.prescriptions[slot.prescriptions.length - 1].percent}%)`}
                            </span>
                          </>
                        ) : slot.isGpp ? (
                          '\u2014'
                        ) : (
                          <>
                            {slot.weight > 0 ? `${slot.weight} kg` : '\u2014'}
                            {slot.isDeload && (
                              <span className="block text-[10px] text-muted">
                                {'\u2193'} Deload
                              </span>
                            )}
                          </>
                        )}
                      </td>

                      {/* Scheme */}
                      <td
                        className={`${TD} text-center text-[12px] font-semibold text-muted tabular-nums whitespace-nowrap`}
                      >
                        {slot.prescriptions !== undefined
                          ? renderPrescriptionScheme(slot)
                          : renderStandardScheme(slot)}
                      </td>

                      {/* Stage (conditional) */}
                      {showStage && (
                        <td className={`${TD} text-center`}>
                          {slot.prescriptions !== undefined || slot.isGpp ? (
                            <span className="text-muted text-xs">{'\u2014'}</span>
                          ) : slot.stage > 0 ? (
                            <StageTag stage={slot.stage} size="sm" />
                          ) : (
                            <span className="text-muted text-xs">{'\u2014'}</span>
                          )}
                        </td>
                      )}

                      {/* Result */}
                      <td className={`${TD} text-center`}>
                        <ResultCell
                          index={row.index}
                          tier={slot.slotId}
                          result={slot.result}
                          variant="table"
                          isTestSlot={slot.isTestSlot === true}
                          onMark={onMark}
                          onUndo={onUndo}
                        />
                      </td>

                      {/* AMRAP (conditional) */}
                      {showAmrap && (
                        <td className={`${TD} text-center`}>
                          {slot.result === 'success' && slot.isAmrap ? (
                            <AmrapInput
                              value={slot.amrapReps}
                              onChange={(reps) => onSetAmrapReps(row.index, slot.slotId, reps)}
                              variant="table"
                              weight={slot.weight}
                              result={slot.result}
                            />
                          ) : (
                            <span className="text-muted text-xs">{'\u2014'}</span>
                          )}
                        </td>
                      )}

                      {/* RPE (conditional) */}
                      {showRpe && (
                        <td className={`${TD} text-center`}>
                          {slot.result === 'success' && slotShowRpe && onSetRpe ? (
                            <RpeSelect
                              value={slot.rpe}
                              onChange={(rpe) => onSetRpe(row.index, slot.slotId, rpe)}
                              workoutIndex={row.index}
                              slotKey={slot.slotId}
                            />
                          ) : slot.rpe !== undefined ? (
                            <span className="text-xs font-bold text-main">{slot.rpe}</span>
                          ) : (
                            <span className="text-muted text-xs">{'\u2014'}</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
