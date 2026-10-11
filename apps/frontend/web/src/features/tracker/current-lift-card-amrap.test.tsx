import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { GenericSlotRow, SetLogEntry } from '@gzclp/domain/types';
import { CurrentLiftCard } from './current-lift-card';

function t1Squat(): GenericSlotRow {
  return {
    slotId: 'd1-t1',
    exerciseId: 'squat',
    exerciseName: 'Sentadilla',
    tier: 't1',
    weight: 100,
    stage: 0,
    sets: 5,
    reps: 3,
    repsMax: undefined,
    isAmrap: true,
    stagesCount: 3,
    result: undefined,
    amrapReps: undefined,
    rpe: undefined,
    isChanged: false,
    isDeload: false,
    role: 'primary',
    notes: undefined,
    prescriptions: undefined,
    isGpp: undefined,
    complexReps: undefined,
    propagatesTo: undefined,
    isTestSlot: undefined,
    isBodyweight: undefined,
    setLogs: undefined,
  };
}

function renderCard(logged: readonly SetLogEntry[]) {
  const onSetTap = vi.fn();
  render(
    <CurrentLiftCard
      slot={t1Squat()}
      workoutIndex={0}
      setLogs={logged.length === 0 ? undefined : logged}
      isLogging={logged.length > 0}
      onMark={vi.fn()}
      onUndo={vi.fn()}
      onSetAmrapReps={vi.fn()}
      onSetRpe={vi.fn()}
      onSetTap={onSetTap}
    />
  );
  return { onSetTap };
}

const FOUR_SETS: readonly SetLogEntry[] = Array.from({ length: 4 }, () => ({ reps: 3 }));

describe('CurrentLiftCard AMRAP set', () => {
  afterEach(cleanup);

  it('logs the reps the lifter entered on the AMRAP set, not the target', () => {
    const { onSetTap } = renderCard(FOUR_SETS);

    const stepper = screen.getByRole('group', { name: 'Reps serie 5 de 5 (AMRAP)' });
    expect(stepper).toHaveTextContent('3');
    for (let i = 0; i < 5; i++) {
      fireEvent.click(screen.getByRole('button', { name: 'Aumentar reps' }));
    }
    fireEvent.click(screen.getByTestId('current-lift-confirm-set'));

    expect(onSetTap).toHaveBeenCalledWith(0, 'd1-t1', 4, 8);
  });

  it('logs the target with a single tap when the AMRAP set only hit the target', () => {
    const { onSetTap } = renderCard(FOUR_SETS);

    fireEvent.click(screen.getByTestId('current-lift-confirm-set'));

    expect(onSetTap).toHaveBeenCalledWith(0, 'd1-t1', 4, 3);
  });

  it('offers no rep stepper before the AMRAP set', () => {
    const { onSetTap } = renderCard(FOUR_SETS.slice(0, 2));

    expect(screen.queryByRole('group', { name: /AMRAP/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('current-lift-confirm-set'));
    expect(onSetTap).toHaveBeenCalledWith(0, 'd1-t1', 2, 3);
  });
});
