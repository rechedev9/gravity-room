import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { GenericSlotRow, GenericWorkoutRow } from '@gzclp/domain/types';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import { StepFirstDay } from './step-first-day';

const DEFINITION = { totalWorkouts: 36 } as unknown as ProgramDefinition;

function slot(overrides: Partial<GenericSlotRow> = {}): GenericSlotRow {
  return {
    slotId: 'a-t1',
    exerciseId: 'squat',
    exerciseName: 'Squat',
    tier: 't1',
    weight: 115,
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
    ...overrides,
  };
}

const WORKOUT: GenericWorkoutRow = {
  index: 0,
  dayName: 'A1 Empuje',
  slots: [
    slot(),
    slot({ slotId: 'a-t2', exerciseId: 'bench', exerciseName: 'Bench', tier: 't2', weight: 47.5 }),
    slot({ slotId: 'a-t3', exerciseId: 'row', exerciseName: 'Row', tier: 't3', weight: 0 }),
  ],
  isChanged: false,
  completedAt: undefined,
};

function renderStep(isGenerating = false) {
  const onStart = vi.fn();
  const onSaveForLater = vi.fn();
  const onBack = vi.fn();
  render(
    <StepFirstDay
      definition={DEFINITION}
      firstWorkout={WORKOUT}
      cycleDayNames={['A1', 'B1', 'A2', 'B2']}
      isGenerating={isGenerating}
      onStart={onStart}
      onSaveForLater={onSaveForLater}
      onBack={onBack}
    />
  );
  return { onStart, onSaveForLater, onBack };
}

describe('StepFirstDay', () => {
  afterEach(cleanup);

  it('shows day one before it is entered, lift by lift', () => {
    renderStep();

    const lifts = screen.getAllByTestId('start-first-day-slot');
    expect(lifts).toHaveLength(3);
    expect(lifts[0].textContent).toContain('115 kg');
    expect(lifts[0].textContent).toContain('5×3+');
  });

  it('says the load is the user’s choice when the program prescribes none', () => {
    renderStep();
    expect(screen.getAllByTestId('start-first-day-slot')[2].textContent).toContain('a elegir');
  });

  it('states how a success and a failure move the program', () => {
    renderStep();
    expect(screen.getByText(/subes de carga/i)).toBeInTheDocument();
    expect(screen.getByText(/cambias de esquema, no de peso/i)).toBeInTheDocument();
  });

  it('shows the full cycle with day one marked', () => {
    renderStep();
    ['A1', 'B1', 'A2', 'B2'].forEach((name) => {
      expect(screen.getByText(name)).toBeInTheDocument();
    });
    expect(screen.getByText('36 sesiones en total')).toBeInTheDocument();
  });

  it.each([
    { testId: 'start-begin-day', handler: 'onStart' as const },
    { testId: 'start-save-for-later', handler: 'onSaveForLater' as const },
  ])('$testId calls $handler', ({ testId, handler }) => {
    const handlers = renderStep();
    fireEvent.click(screen.getByTestId(testId));
    expect(handlers[handler]).toHaveBeenCalledOnce();
  });

  it('locks both commit paths while the program is being generated', () => {
    renderStep(true);
    expect(screen.getByTestId('start-begin-day')).toBeDisabled();
    expect(screen.getByTestId('start-save-for-later')).toBeDisabled();
  });
});
