import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState, type ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  GenericSlotRow,
  GenericWorkoutRow,
  ResultValue,
  SetLogEntry,
} from '@gzclp/domain/types';
import { DetailedDayView } from '@/features/program-view/detailed-day-view';
import { useSetLogging } from '@/hooks/use-set-logging';
import { CurrentLiftCard } from './current-lift-card';

// Sheiko 7.1 deadlift ladder: engine keeps only the last group in sets/reps (3 x 1).
function ladderSlot(overrides: Partial<GenericSlotRow> = {}): GenericSlotRow {
  return {
    slotId: 'comp-dl',
    exerciseId: 'deadlift',
    exerciseName: 'Deadlift',
    tier: 'comp',
    weight: 198,
    stage: 0,
    sets: 3,
    reps: 1,
    repsMax: undefined,
    isAmrap: false,
    stagesCount: 1,
    result: undefined,
    amrapReps: undefined,
    rpe: undefined,
    isChanged: false,
    isDeload: false,
    role: 'primary',
    notes: undefined,
    prescriptions: [
      { percent: 55, reps: 3, sets: 1, weight: 120 },
      { percent: 65, reps: 3, sets: 1, weight: 142.5 },
      { percent: 75, reps: 3, sets: 1, weight: 165 },
      { percent: 85, reps: 2, sets: 2, weight: 187.5 },
      { percent: 90, reps: 1, sets: 3, weight: 198 },
    ],
    isGpp: undefined,
    complexReps: undefined,
    propagatesTo: undefined,
    isTestSlot: undefined,
    isBodyweight: undefined,
    setLogs: undefined,
    ...overrides,
  };
}

const marks: { value: ResultValue; logs: readonly SetLogEntry[] | undefined }[] = [];

function LadderSession(): ReactNode {
  const [marked, setMarked] = useState<{
    result: ResultValue;
    logs: readonly SetLogEntry[];
  } | null>(null);
  const row: GenericWorkoutRow = {
    index: 0,
    dayName: 'Day 2',
    isChanged: false,
    completedAt: undefined,
    slots: [ladderSlot({ result: marked?.result, setLogs: marked?.logs })],
  };
  const logging = useSetLogging(
    (_workoutIndex, _slotId, value, logs) => {
      marks.push({ value, logs });
      setMarked({ result: value, logs: logs ?? [] });
    },
    [row],
    undefined
  );

  return (
    <DetailedDayView
      workout={row}
      isCurrent
      onMark={vi.fn()}
      onUndo={vi.fn()}
      onSetAmrapReps={vi.fn()}
      onSetTap={(workoutIndex, slotId, setIndex, reps, weight) =>
        logging.logSet(workoutIndex, slotId, setIndex, reps, weight)
      }
      getSetLogs={logging.getSetLogs}
      isSlotLogging={logging.isLogging}
    />
  );
}

async function confirm(label: string): Promise<void> {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: `Confirmar serie ${label}` }));
    await new Promise<void>((resolve) => queueMicrotask(resolve));
  });
}

describe('prescription ladder in the detailed view', () => {
  afterEach(() => {
    marks.length = 0;
    cleanup();
  });

  it('keeps the heavy sets on screen after the third warm-up is confirmed', async () => {
    render(<LadderSession />);

    for (const label of ['W1', 'W2', 'W3']) await confirm(label);

    expect(marks).toHaveLength(0);
    for (const label of ['W4', 'W5', '1', '2', '3']) {
      expect(screen.getByRole('button', { name: `Confirmar serie ${label}` })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Confirmar serie W4' })).toBeEnabled();
  });

  it('closes the lift on the last planned set and judges each set against its own reps', async () => {
    render(<LadderSession />);

    for (const label of ['W1', 'W2', 'W3', 'W4', 'W5', '1', '2', '3']) await confirm(label);

    expect(marks).toHaveLength(1);
    expect(marks[0]?.value).toBe('success');
    expect(marks[0]?.logs?.map((entry) => entry.reps)).toEqual([3, 3, 3, 2, 2, 1, 1, 1]);
  });

  it('fails the lift when a heavy single is missed', async () => {
    render(<LadderSession />);

    for (const label of ['W1', 'W2', 'W3', 'W4', 'W5', '1', '2']) await confirm(label);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Reps serie 3' }), {
      target: { value: '0' },
    });
    await confirm('3');

    expect(marks).toHaveLength(1);
    expect(marks[0]?.value).toBe('fail');
  });
});

describe('prescription ladder in the compact view', () => {
  afterEach(cleanup);

  it('can still be completed from the result footer', () => {
    const onMark = vi.fn();
    render(
      <CurrentLiftCard
        slot={ladderSlot()}
        workoutIndex={0}
        setLogs={undefined}
        isLogging={false}
        onMark={onMark}
        onUndo={vi.fn()}
        onSetAmrapReps={vi.fn()}
        onSetTap={vi.fn()}
      />
    );

    expect(screen.queryByTestId('current-lift-confirm-set')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Marcar .* como éxito$/ }));
    expect(onMark).toHaveBeenCalledWith(0, 'comp-dl', 'success');
  });
});
