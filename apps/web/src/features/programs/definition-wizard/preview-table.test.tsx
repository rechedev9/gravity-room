/**
 * PreviewTable component tests (REQ-PREV-INT-003).
 * Verifies row rendering, data display, and read-only nature.
 */
import { describe, it, expect } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { PreviewTable } from './preview-table';
import type { GenericWorkoutRow, GenericSlotRow } from '@gzclp/shared/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSlotRow(overrides: Partial<GenericSlotRow> = {}): GenericSlotRow {
  return {
    slotId: 'd1-t1',
    exerciseId: 'squat',
    exerciseName: 'Sentadilla',
    tier: 't1',
    weight: 60,
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
    role: undefined,
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

function makeRow(index: number, overrides: Partial<GenericWorkoutRow> = {}): GenericWorkoutRow {
  return {
    index,
    dayName: `Day ${index + 1}`,
    slots: [makeSlotRow()],
    isChanged: false,
    completedAt: undefined,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PreviewTable', () => {
  it('renders correct number of rows matching input array length', () => {
    const rows = [makeRow(0), makeRow(1), makeRow(2)];

    render(<PreviewTable rows={rows} />);

    // Each row has one slot, so 3 <tr> in tbody
    const table = screen.getByRole('table');
    const bodyRows = table.querySelectorAll('tbody tr');
    expect(bodyRows.length).toBe(3);
  });

  it('displays exercise name, sets, reps, and weight from first row', () => {
    const rows = [
      makeRow(0, {
        dayName: 'Dia 1',
        slots: [makeSlotRow({ exerciseName: 'Sentadilla', sets: 3, reps: 5, weight: 60 })],
      }),
    ];

    render(<PreviewTable rows={rows} />);

    expect(screen.getByText('Sentadilla')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
  });

  it('does not render any input elements (read-only)', () => {
    const rows = [makeRow(0)];

    render(<PreviewTable rows={rows} />);

    const inputs = document.querySelectorAll('input, textarea, select');
    expect(inputs.length).toBe(0);
  });
});
