import type { ResultValue } from '@gzclp/shared/types';
import { ExerciseCard } from './exercise-card';

export interface DayViewSlot {
  readonly key: string;
  readonly exerciseName: string;
  readonly tierLabel: string;
  readonly tier: string;
  readonly role: 'primary' | 'secondary' | 'accessory';
  readonly weight: number;
  readonly scheme: string;
  readonly stage: number;
  readonly showStage: boolean;
  readonly isAmrap: boolean;
  readonly result: ResultValue | undefined;
  readonly amrapReps: number | undefined;
  readonly rpe: number | undefined;
  readonly showRpe: boolean;
  readonly isChanged: boolean;
  readonly isDeload: boolean;
  readonly notes: string | undefined;
}

interface DayViewProps {
  readonly workoutIndex: number;
  readonly workoutNumber: number;
  readonly dayName: string;
  readonly isCurrent: boolean;
  readonly instanceId?: string;
  readonly slots: readonly DayViewSlot[];
  readonly displayMode?: 'flat' | 'blocks';
  readonly onMark: (workoutIndex: number, slotKey: string, value: ResultValue) => void;
  readonly onUndo: (workoutIndex: number, slotKey: string) => void;
  readonly onSetAmrapReps: (
    workoutIndex: number,
    slotKey: string,
    reps: number | undefined
  ) => void;
  readonly onSetRpe?: (workoutIndex: number, slotKey: string, rpe: number | undefined) => void;
}

const BLOCK_ORDER = ['core', 'activation', 'proprioception', 'fundamental'] as const;

const BLOCK_HEADERS: Readonly<
  Record<string, { readonly name: string; readonly duration: string }>
> = {
  core: { name: 'Block 1 \u2014 Core Strengthening', duration: '~10\u2032' },
  activation: { name: 'Block 2 \u2014 Muscle Activation', duration: '~10\u2032' },
  proprioception: { name: 'Block 3 \u2014 Proprioception & Coordination', duration: '~20\u2032' },
  fundamental: { name: 'Block 4 \u2014 The Fundamental', duration: '~20\u2032' },
};

interface SlotGroup {
  readonly tier: string;
  readonly header: { readonly name: string; readonly duration: string };
  readonly slots: readonly DayViewSlot[];
  readonly completed: number;
  readonly total: number;
}

function groupSlotsByTier(slots: readonly DayViewSlot[]): readonly SlotGroup[] {
  const groups: SlotGroup[] = [];
  for (const tierKey of BLOCK_ORDER) {
    const tierSlots = slots.filter((s) => s.tier === tierKey);
    if (tierSlots.length === 0) continue;
    const header = BLOCK_HEADERS[tierKey] ?? { name: tierKey, duration: '' };
    const completed = tierSlots.filter((s) => s.result !== undefined).length;
    groups.push({ tier: tierKey, header, slots: tierSlots, completed, total: tierSlots.length });
  }
  // Any remaining slots not in BLOCK_ORDER
  const knownTiers = new Set<string>(BLOCK_ORDER);
  const remaining = slots.filter((s) => !knownTiers.has(s.tier));
  if (remaining.length > 0) {
    groups.push({
      tier: 'other',
      header: { name: 'Other', duration: '' },
      slots: remaining,
      completed: remaining.filter((s) => s.result !== undefined).length,
      total: remaining.length,
    });
  }
  return groups;
}

function renderExerciseCard(
  slot: DayViewSlot,
  workoutIndex: number,
  instanceId: string | undefined,
  displayMode: 'flat' | 'blocks' | undefined,
  onMark: DayViewProps['onMark'],
  onUndo: DayViewProps['onUndo'],
  onSetAmrapReps: DayViewProps['onSetAmrapReps'],
  onSetRpe: DayViewProps['onSetRpe']
): React.ReactNode {
  return (
    <ExerciseCard
      key={slot.key}
      workoutIndex={workoutIndex}
      slotKey={slot.key}
      exerciseName={slot.exerciseName}
      tierLabel={slot.tierLabel}
      role={slot.role}
      weight={slot.weight}
      scheme={slot.scheme}
      stage={slot.stage}
      showStage={slot.showStage}
      isAmrap={slot.isAmrap}
      result={slot.result}
      amrapReps={slot.amrapReps}
      rpe={slot.rpe}
      showRpe={slot.showRpe}
      isChanged={slot.isChanged}
      isDeload={slot.isDeload}
      instanceId={instanceId}
      notes={slot.notes}
      displayMode={displayMode}
      tier={slot.tier}
      onMark={onMark}
      onUndo={onUndo}
      onSetAmrapReps={slot.isAmrap ? onSetAmrapReps : undefined}
      onSetRpe={slot.showRpe ? onSetRpe : undefined}
    />
  );
}

export function DayView({
  workoutIndex,
  workoutNumber,
  dayName,
  isCurrent,
  instanceId,
  slots,
  displayMode,
  onMark,
  onUndo,
  onSetAmrapReps,
  onSetRpe,
}: DayViewProps): React.ReactNode {
  return (
    <div
      className="animate-[card-enter_0.15s_ease-out]"
      {...(isCurrent ? { 'data-current-row': true } : {})}
    >
      {/* Day header */}
      <div className="flex items-baseline gap-3 mb-5">
        <span className="font-display text-3xl text-heading">#{workoutNumber}</span>
        <span className="font-mono text-[11px] font-bold text-muted uppercase tracking-widest">
          {dayName}
        </span>
      </div>

      {displayMode === 'blocks' ? (
        <div className="flex flex-col gap-6">
          {groupSlotsByTier(slots).map((group) => (
            <div key={group.tier}>
              {/* Block header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-[13px] font-bold text-heading">{group.header.name}</h3>
                  {group.header.duration && (
                    <span className="text-[11px] text-muted">{group.header.duration}</span>
                  )}
                </div>
                <span className="text-[11px] font-bold text-muted">
                  {group.completed}/{group.total}
                </span>
              </div>
              {/* Block exercise cards */}
              <div className="flex flex-col gap-3">
                {group.slots.map((slot) =>
                  renderExerciseCard(
                    slot,
                    workoutIndex,
                    instanceId,
                    displayMode,
                    onMark,
                    onUndo,
                    onSetAmrapReps,
                    onSetRpe
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {slots.map((slot) =>
            renderExerciseCard(
              slot,
              workoutIndex,
              instanceId,
              displayMode,
              onMark,
              onUndo,
              onSetAmrapReps,
              onSetRpe
            )
          )}
        </div>
      )}
    </div>
  );
}
