import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { GenericSlotRow } from '@gzclp/domain/types';
import { SlotResultFooter } from './slot-result-footer';

function makeSlot(overrides: Partial<GenericSlotRow> = {}): GenericSlotRow {
  return {
    slotId: 'd1-t1',
    exerciseId: 'overhead-press',
    exerciseName: 'Press Militar',
    tier: 't1',
    weight: 40,
    stage: 1,
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
    ...overrides,
  };
}

const baseHandlers = {
  onMark: vi.fn(),
  onUndo: vi.fn(),
  onSetAmrapReps: vi.fn(),
};

describe('SlotResultFooter', () => {
  it('hides pass/fail mark actions in set-first mode while the slot is still open', () => {
    render(
      <SlotResultFooter
        slot={makeSlot()}
        workoutIndex={0}
        isLogging={false}
        setFirstMode
        {...baseHandlers}
      />
    );

    expect(screen.queryByTestId('result-cell-mark-success')).not.toBeInTheDocument();
    expect(screen.queryByTestId('result-cell-mark-fail')).not.toBeInTheDocument();
  });

  it('still shows pass/fail in compact (slot-first) mode when the slot is open', () => {
    render(
      <SlotResultFooter
        slot={makeSlot()}
        workoutIndex={0}
        isLogging={false}
        setFirstMode={false}
        {...baseHandlers}
      />
    );

    expect(screen.getByTestId('result-cell-mark-success')).toBeInTheDocument();
    expect(screen.getByTestId('result-cell-mark-fail')).toBeInTheDocument();
  });

  it('keeps undo available after the slot has a result in set-first mode', () => {
    render(
      <SlotResultFooter
        slot={makeSlot({ result: 'success' })}
        workoutIndex={0}
        isLogging={false}
        setFirstMode
        {...baseHandlers}
      />
    );

    expect(screen.getByTestId('result-cell-undo')).toBeInTheDocument();
    expect(screen.queryByTestId('result-cell-mark-success')).not.toBeInTheDocument();
  });

  it('still offers the test-slot register max control in set-first mode', () => {
    render(
      <SlotResultFooter
        slot={makeSlot({ isTestSlot: true })}
        workoutIndex={0}
        isLogging={false}
        setFirstMode
        {...baseHandlers}
      />
    );

    expect(screen.getByTestId('result-cell-register-max')).toBeInTheDocument();
  });
});
