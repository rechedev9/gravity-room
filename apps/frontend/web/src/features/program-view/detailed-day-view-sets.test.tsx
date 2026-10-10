import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { GenericSlotRow, GenericWorkoutRow, SetLogEntry } from '@gzclp/domain/types';
import { writeWeightUnit } from '@/lib/weight-unit';
import { DetailedDayView } from './detailed-day-view';

function slot(overrides: Partial<GenericSlotRow> = {}): GenericSlotRow {
  return {
    slotId: 'a-t1',
    exerciseId: 'squat',
    exerciseName: 'Squat',
    tier: 't1',
    weight: 100,
    stage: 0,
    sets: 3,
    reps: 5,
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

function renderDay(
  slots: readonly GenericSlotRow[],
  logs: Readonly<Record<string, readonly SetLogEntry[]>> = {}
) {
  const onSetTap = vi.fn();
  const workout: GenericWorkoutRow = {
    index: 2,
    dayName: 'A1',
    slots,
    isChanged: false,
    completedAt: undefined,
  };
  render(
    <DetailedDayView
      workout={workout}
      isCurrent
      onMark={vi.fn()}
      onUndo={vi.fn()}
      onSetAmrapReps={vi.fn()}
      onSetTap={onSetTap}
      getSetLogs={(_, slotId) => logs[slotId]}
    />
  );
  return { onSetTap };
}

describe('DetailedDayView set rows', () => {
  afterEach(() => {
    cleanup();
    writeWeightUnit('kg');
  });

  it('opens only the next set and records the planned load when nothing is edited', () => {
    const { onSetTap } = renderDay([slot()]);

    expect(screen.getByRole('spinbutton', { name: 'Peso serie 1' })).toHaveValue(100);
    expect(screen.getByRole('spinbutton', { name: 'Reps serie 1' })).toHaveValue(5);
    expect(screen.getByRole('spinbutton', { name: 'Peso serie 2' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Confirmar serie 2' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirmar serie 1' }));
    expect(onSetTap).toHaveBeenCalledWith(2, 'a-t1', 0, 5, 100);
  });

  it('records the weight and reps the lifter typed', () => {
    const { onSetTap } = renderDay([slot()]);

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Peso serie 1' }), {
      target: { value: '102.5' },
    });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Reps serie 1' }), {
      target: { value: '4' },
    });
    fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Reps serie 1' }), { key: 'Enter' });

    expect(onSetTap).toHaveBeenCalledWith(2, 'a-t1', 0, 4, 102.5);
  });

  it('refuses to confirm while a field is empty', () => {
    const { onSetTap } = renderDay([slot()]);

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Peso serie 1' }), {
      target: { value: '' },
    });
    const confirm = screen.getByRole('button', { name: 'Confirmar serie 1' });
    expect(confirm).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Reps serie 1' }), { key: 'Enter' });
    expect(onSetTap).not.toHaveBeenCalled();
  });

  it('shows pounds but stores kilograms, without a round trip on an untouched load', () => {
    writeWeightUnit('lbs');
    const { onSetTap } = renderDay([slot()]);

    const weight = screen.getByRole('spinbutton', { name: 'Peso serie 1' });
    expect(weight).toHaveValue(220.5);
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar serie 1' }));
    expect(onSetTap).toHaveBeenLastCalledWith(2, 'a-t1', 0, 5, 100);

    fireEvent.change(weight, { target: { value: '225' } });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar serie 1' }));
    expect(onSetTap).toHaveBeenLastCalledWith(2, 'a-t1', 0, 5, 102.06);
  });

  it('turns a confirmed set into a logged row and opens the following one', () => {
    renderDay([slot()], { 'a-t1': [{ reps: 4, weight: 102.5 }] });

    const table = screen.getByTestId('slot-set-table');
    expect(screen.queryByRole('spinbutton', { name: 'Reps serie 1' })).not.toBeInTheDocument();
    expect(table).toHaveTextContent('102.5 kg');
    expect(table).toHaveTextContent('4 reps');
    // 4 reps on a 5 rep target is a missed set.
    expect(within(table).getByRole('img', { name: 'Serie fallada' })).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Reps serie 2' })).toBeEnabled();
  });

  it('offers no weight field on bodyweight work', () => {
    const { onSetTap } = renderDay([slot({ isBodyweight: true, weight: 0 })]);

    expect(screen.queryByRole('spinbutton', { name: 'Peso serie 1' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar serie 1' }));
    expect(onSetTap).toHaveBeenCalledWith(2, 'a-t1', 0, 5, undefined);
  });

  it('marks only the first unresolved lift of the current day as the focal card', () => {
    renderDay([
      slot({ result: 'success' }),
      slot({ slotId: 'a-t2', exerciseName: 'Bench', tier: 't2' }),
      slot({ slotId: 'a-t3', exerciseName: 'Row', tier: 't3' }),
    ]);

    const focal = screen.getAllByRole('region').filter((card) => card.dataset['focal'] === 'true');
    expect(focal.map((card) => card.dataset['slotId'])).toEqual(['a-t2']);
  });
});
