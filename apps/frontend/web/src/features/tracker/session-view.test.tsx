import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { GenericSlotRow, GenericWorkoutRow } from '@gzclp/domain/types';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import { SessionView } from './session-view';

const DEFINITION: ProgramDefinition = {
  id: 'fixture',
  name: 'Fixture',
  description: 'Session view fixture.',
  author: 'test',
  version: 1,
  category: 'strength',
  source: 'preset',
  cycleLength: 1,
  totalWorkouts: 8,
  workoutsPerWeek: 2,
  exercises: { squat: { name: 'Squat' }, bench: { name: 'Bench' } },
  configFields: [
    { key: 'squat', label: 'Squat', type: 'weight', min: 20, step: 2.5 },
    { key: 'bench', label: 'Bench', type: 'weight', min: 20, step: 2.5 },
  ],
  weightIncrements: { squat: 5, bench: 2.5 },
  days: [
    {
      name: 'A1',
      slots: [
        {
          id: 'a-t1',
          exerciseId: 'squat',
          tier: 't1',
          stages: [
            { sets: 5, reps: 3, amrap: true },
            { sets: 6, reps: 2, amrap: true },
          ],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'advance_stage' },
          onFinalStageFail: { type: 'deload_percent', percent: 10 },
          startWeightKey: 'squat',
        },
        {
          id: 'a-t2',
          exerciseId: 'bench',
          tier: 't2',
          stages: [{ sets: 3, reps: 10 }],
          onSuccess: { type: 'add_weight' },
          onMidStageFail: { type: 'no_change' },
          onFinalStageFail: { type: 'no_change' },
          startWeightKey: 'bench',
        },
      ],
    },
  ],
};

const CONFIG = { squat: 100, bench: 60 };

function slot(overrides: Partial<GenericSlotRow> = {}): GenericSlotRow {
  return {
    slotId: 'a-t1',
    exerciseId: 'squat',
    exerciseName: 'Squat',
    tier: 't1',
    weight: 100,
    stage: 0,
    sets: 5,
    reps: 3,
    repsMax: undefined,
    isAmrap: true,
    stagesCount: 2,
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

function row(index: number, slots: readonly GenericSlotRow[]): GenericWorkoutRow {
  return { index, dayName: 'A1', slots, isChanged: false, completedAt: undefined };
}

const T2 = slot({
  slotId: 'a-t2',
  exerciseId: 'bench',
  exerciseName: 'Bench',
  tier: 't2',
  weight: 60,
  sets: 3,
  reps: 10,
  isAmrap: false,
  stagesCount: 1,
  role: 'secondary',
});

function renderView(
  overrides: {
    readonly workout?: GenericWorkoutRow;
    readonly rows?: readonly GenericWorkoutRow[];
    readonly isCurrent?: boolean;
    readonly rest?: { readonly seconds: number; readonly id: number } | null;
    readonly actions?: Partial<Parameters<typeof SessionView>[0]['slotActions']>;
  } = {}
) {
  const onSetTap = vi.fn();
  const onMark = vi.fn();
  const onUndo = vi.fn();
  const workout = overrides.workout ?? row(1, [slot(), T2]);

  render(
    <SessionView
      definition={DEFINITION}
      config={CONFIG}
      results={{}}
      rows={
        overrides.rows ?? [
          row(0, [slot({ result: 'success' }), { ...T2, result: 'success' }]),
          workout,
        ]
      }
      workout={workout}
      isCurrent={overrides.isCurrent ?? true}
      rest={overrides.rest ?? null}
      onSkipRest={vi.fn()}
      onGoToNextDay={vi.fn()}
      slotActions={{
        onMark,
        onUndo,
        onSetAmrapReps: vi.fn(),
        onSetTap,
        ...overrides.actions,
      }}
    />
  );

  return { onSetTap, onMark, onUndo };
}

/** Renders the view with a stable rows array so a re-render can flip one slot. */
function renderRerenderable() {
  const base = row(0, [slot({ result: 'success' }), { ...T2, result: 'success' }]);
  const props = (workout: GenericWorkoutRow) => (
    <SessionView
      definition={DEFINITION}
      config={CONFIG}
      results={{}}
      rows={[base, workout]}
      workout={workout}
      isCurrent
      rest={null}
      onSkipRest={vi.fn()}
      onGoToNextDay={vi.fn()}
      slotActions={{
        onMark: vi.fn(),
        onUndo: vi.fn(),
        onSetAmrapReps: vi.fn(),
        onSetTap: vi.fn(),
      }}
    />
  );
  const view = render(props(row(1, [slot(), T2])));
  return {
    rerender: (workout: GenericWorkoutRow) => view.rerender(props(workout)),
  };
}

describe('SessionView', () => {
  afterEach(cleanup);

  it('promotes the first open lift to the hero card and demotes the rest', () => {
    renderView();

    const hero = screen.getByTestId('current-lift-card');
    expect(hero).toHaveAttribute('data-slot-id', 'a-t1');
    expect(within(hero).getByText('100')).toBeInTheDocument();

    // The second open lift stays in the secondary grid, not the hero.
    expect(within(screen.getByTestId('compact-day-grid')).getByText('60 kg')).toBeInTheDocument();
  });

  it('confirms the next set from the hero primary action', () => {
    const { onSetTap } = renderView();

    fireEvent.click(screen.getByTestId('current-lift-confirm-set'));
    expect(onSetTap).toHaveBeenCalledWith(1, 'a-t1', 0, 3);
  });

  it('keeps confirming sets after the first one is logged', () => {
    // Regression: gating the primary action on "this slot has in-progress logs"
    // disabled it from set 2 onward, making the hero unusable with a mouse.
    const { onSetTap } = renderView({
      actions: {
        getSetLogs: () => [{ reps: 3 }, { reps: 3 }],
        isSlotLogging: () => true,
      },
    });

    const confirm = screen.getByTestId('current-lift-confirm-set');
    expect(confirm).toBeEnabled();

    fireEvent.click(confirm);
    expect(onSetTap).toHaveBeenCalledWith(1, 'a-t1', 2, 3);
  });

  it('marks a failure from the hero secondary action', () => {
    const { onMark } = renderView();

    fireEvent.click(screen.getByTestId('current-lift-fail'));
    expect(onMark).toHaveBeenCalledWith(1, 'a-t1', 'fail');
  });

  it('docks the rest countdown inside the hero card instead of floating it', () => {
    renderView({ rest: { seconds: 180, id: 1 } });

    const hero = screen.getByTestId('current-lift-card');
    expect(within(hero).getByTestId('rest-timer')).toBeInTheDocument();
  });

  it('moves undo onto the completed card', () => {
    renderView({
      workout: row(1, [slot({ result: 'success', setLogs: [{ reps: 3 }] }), T2]),
    });

    const completed = screen.getByTestId('completed-slot-row');
    expect(within(completed).getByTestId('result-cell-undo')).toBeInTheDocument();
  });

  it('shows no hero when the selected day is not the current one', () => {
    renderView({ isCurrent: false });

    expect(screen.queryByTestId('current-lift-card')).not.toBeInTheDocument();
    expect(screen.getByTestId('compact-day-grid')).toBeInTheDocument();
  });

  it('explains the cost of failing the current set from the engine, not from copy', () => {
    renderView();

    const panel = screen.getByTestId('session-fail-preview');
    // Stage ladder: 5x3+ -> 6x2+ at the same weight.
    expect(panel.textContent).toContain('6×2');
    expect(panel.textContent).toMatch(/mismo peso/i);
  });

  it('explains a freshly recorded failure with the engine stage ladder', () => {
    const { rerender } = renderRerenderable();

    // Baseline render has no failure — the explainer must stay away.
    expect(screen.queryByTestId('failure-explainer')).not.toBeInTheDocument();

    rerender(row(1, [slot({ result: 'fail' }), T2]));

    const explainer = screen.getByTestId('failure-explainer');
    expect(explainer).toHaveAttribute('data-slot-id', 'a-t1');
    // Stage 1 (5x3+) -> stage 2 (6x2+), and the load is explicitly held.
    expect(explainer.textContent).toContain('5 × 3+');
    expect(explainer.textContent).toContain('6 × 2+');
    expect(explainer.textContent).toMatch(/el peso no baja/i);
  });

  it('dismisses the failure explainer once acknowledged', () => {
    const { rerender } = renderRerenderable();
    rerender(row(1, [slot({ result: 'fail' }), T2]));

    fireEvent.click(screen.getByTestId('failure-acknowledge'));
    expect(screen.queryByTestId('failure-explainer')).not.toBeInTheDocument();
  });

  it('closes a finished day with a summary and the queued next loads', () => {
    renderView({
      workout: row(1, [
        slot({
          result: 'success',
          setLogs: [{ reps: 3 }, { reps: 3 }, { reps: 3 }, { reps: 3 }, { reps: 7 }],
        }),
        { ...T2, result: 'success' },
      ]),
      rows: [
        row(0, [slot({ result: 'success' }), { ...T2, result: 'success' }]),
        row(1, [
          slot({
            result: 'success',
            setLogs: [{ reps: 3 }, { reps: 3 }, { reps: 3 }, { reps: 3 }, { reps: 7 }],
          }),
          { ...T2, result: 'success' },
        ]),
        row(2, [slot({ weight: 105 }), { ...T2, weight: 62.5 }]),
      ],
    });

    const panel = screen.getByTestId('day-completed-panel');
    expect(panel.textContent).toContain('Día 2 completado');
    // Next scheduled load comes straight from the engine rows.
    expect(panel.textContent).toContain('105 kg');
    expect(screen.getAllByTestId('day-completed-line')).toHaveLength(2);
    // Completed rows are folded away behind "fix something".
    expect(screen.queryByTestId('completed-slot-row')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('day-completed-review'));
    expect(screen.getAllByTestId('completed-slot-row').length).toBeGreaterThan(0);
  });

  it('lists what the same session looked like last time', () => {
    renderView();

    const panel = screen.getByTestId('session-side-panel');
    expect(within(panel).getByText('100 · 5×3')).toBeInTheDocument();
  });
});
