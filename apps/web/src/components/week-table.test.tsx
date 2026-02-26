import { describe, it, expect, mock } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { WeekTable } from './week-table';
import type { GenericSlotRow, GenericWorkoutRow } from '@gzclp/shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSlot(overrides: Partial<GenericSlotRow> = {}): GenericSlotRow {
  return {
    slotId: overrides.slotId ?? 'slot-0',
    exerciseId: overrides.exerciseId ?? 'squat',
    exerciseName: overrides.exerciseName ?? 'Squat',
    tier: overrides.tier ?? 't1',
    weight: overrides.weight ?? 60,
    stage: overrides.stage ?? 0,
    sets: overrides.sets ?? 5,
    reps: overrides.reps ?? 3,
    repsMax: overrides.repsMax,
    isAmrap: overrides.isAmrap ?? false,
    stagesCount: overrides.stagesCount ?? 1,
    result: overrides.result,
    amrapReps: overrides.amrapReps,
    rpe: overrides.rpe,
    isChanged: overrides.isChanged ?? false,
    role: overrides.role ?? 'primary',
  };
}

function makeRow(
  index: number,
  slots: Partial<GenericSlotRow>[],
  dayName?: string
): GenericWorkoutRow {
  return {
    index,
    dayName: dayName ?? `Day ${index + 1}`,
    isChanged: false,
    slots: slots.map((s, i) => makeSlot({ slotId: `slot-${i}`, ...s })),
  };
}

const noop = mock(() => undefined);

function renderTable(weekRows: GenericWorkoutRow[]): void {
  render(
    <WeekTable
      weekRows={weekRows}
      firstPendingIndex={0}
      onMark={noop as unknown as (i: number, s: string, v: 'success' | 'fail') => void}
      onUndo={noop as unknown as (i: number, s: string) => void}
      onSetAmrapReps={noop as unknown as (i: number, s: string, r: number | undefined) => void}
      onSetRpe={noop as unknown as (i: number, s: string, r: number | undefined) => void}
    />
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WeekTable conditional columns', () => {
  describe('GZCLP-like data (multi-stage, amrap, primary roles)', () => {
    it('shows Etapa column when any slot has stagesCount > 1', () => {
      renderTable([
        makeRow(0, [
          { tier: 't1', stagesCount: 3, isAmrap: true, role: 'primary' },
          { tier: 't2', stagesCount: 3, role: 'secondary', slotId: 't2' },
          { tier: 't3', stagesCount: 1, isAmrap: true, role: 'primary', slotId: 't3' },
        ]),
      ]);

      const headers = screen.getAllByRole('columnheader');
      const headerTexts = headers.map((h) => h.textContent);
      expect(headerTexts).toContain('Etapa');
    });

    it('shows AMRAP column when any slot has isAmrap = true', () => {
      renderTable([
        makeRow(0, [
          { isAmrap: true, stagesCount: 3, role: 'primary' },
          { isAmrap: false, stagesCount: 3, role: 'secondary', slotId: 't2' },
        ]),
      ]);

      const headers = screen.getAllByRole('columnheader');
      const headerTexts = headers.map((h) => h.textContent);
      expect(headerTexts).toContain('AMRAP');
    });

    it('shows RPE column when any slot has role = primary', () => {
      renderTable([
        makeRow(0, [
          { role: 'primary', stagesCount: 1 },
          { role: 'secondary', stagesCount: 1, slotId: 't2' },
        ]),
      ]);

      const headers = screen.getAllByRole('columnheader');
      const headerTexts = headers.map((h) => h.textContent);
      expect(headerTexts).toContain('RPE');
    });

    it('renders all 8 columns for full GZCLP data', () => {
      renderTable([
        makeRow(0, [
          { tier: 't1', stagesCount: 3, isAmrap: true, role: 'primary' },
          { tier: 't2', stagesCount: 3, role: 'secondary', slotId: 't2' },
          { tier: 't3', stagesCount: 1, isAmrap: true, role: 'primary', slotId: 't3' },
        ]),
      ]);

      const headers = screen.getAllByRole('columnheader');
      expect(headers).toHaveLength(8);
    });
  });

  describe('single-stage, no-amrap, no-primary data', () => {
    it('hides Etapa column when all slots have stagesCount = 1', () => {
      renderTable([
        makeRow(0, [
          { stagesCount: 1, isAmrap: false, role: 'secondary' },
          { stagesCount: 1, isAmrap: false, role: 'secondary', slotId: 't2' },
        ]),
      ]);

      const headers = screen.getAllByRole('columnheader');
      const headerTexts = headers.map((h) => h.textContent);
      expect(headerTexts).not.toContain('Etapa');
    });

    it('hides AMRAP column when no slot has isAmrap', () => {
      renderTable([
        makeRow(0, [
          { isAmrap: false, stagesCount: 1, role: 'secondary' },
          { isAmrap: false, stagesCount: 1, role: 'secondary', slotId: 't2' },
        ]),
      ]);

      const headers = screen.getAllByRole('columnheader');
      const headerTexts = headers.map((h) => h.textContent);
      expect(headerTexts).not.toContain('AMRAP');
    });

    it('hides RPE column when no slot has role = primary', () => {
      renderTable([
        makeRow(0, [
          { role: 'secondary', stagesCount: 1 },
          { role: 'accessory', stagesCount: 1, slotId: 't2' },
        ]),
      ]);

      const headers = screen.getAllByRole('columnheader');
      const headerTexts = headers.map((h) => h.textContent);
      expect(headerTexts).not.toContain('RPE');
    });

    it('renders only 5 columns for minimal data', () => {
      renderTable([makeRow(0, [{ stagesCount: 1, isAmrap: false, role: 'secondary' }])]);

      const headers = screen.getAllByRole('columnheader');
      // Tier + Ejercicio + Peso + Esquema + Resultado = 5
      expect(headers).toHaveLength(5);
    });
  });

  describe('mixed data (PPL-like: amrap on some, multi-stage accessories)', () => {
    it('shows AMRAP and Etapa when accessories have stages and main has amrap', () => {
      renderTable([
        makeRow(0, [
          { tier: 'main', role: 'primary', isAmrap: true, stagesCount: 1 },
          { tier: 'accessory', role: 'accessory', isAmrap: false, stagesCount: 3, slotId: 'acc1' },
          { tier: 'accessory', role: 'accessory', isAmrap: false, stagesCount: 3, slotId: 'acc2' },
        ]),
      ]);

      const headers = screen.getAllByRole('columnheader');
      const headerTexts = headers.map((h) => h.textContent);
      expect(headerTexts).toContain('Etapa');
      expect(headerTexts).toContain('AMRAP');
      expect(headerTexts).toContain('RPE');
    });
  });

  describe('day header colSpan', () => {
    it('uses correct colSpan matching visible column count', () => {
      const { container } = render(
        <WeekTable
          weekRows={[makeRow(0, [{ stagesCount: 1, isAmrap: false, role: 'secondary' }])]}
          firstPendingIndex={0}
          onMark={noop as unknown as (i: number, s: string, v: 'success' | 'fail') => void}
          onUndo={noop as unknown as (i: number, s: string) => void}
          onSetAmrapReps={noop as unknown as (i: number, s: string, r: number | undefined) => void}
        />
      );

      // 5 columns (no stage, no amrap, no rpe)
      const dayHeaderCells = container.querySelectorAll('td[colspan]');
      expect(dayHeaderCells.length).toBeGreaterThan(0);
      expect(dayHeaderCells[0].getAttribute('colspan')).toBe('5');
    });

    it('uses colSpan 8 for full GZCLP data', () => {
      const { container } = render(
        <WeekTable
          weekRows={[
            makeRow(0, [
              { stagesCount: 3, isAmrap: true, role: 'primary' },
              { stagesCount: 3, role: 'secondary', slotId: 't2' },
            ]),
          ]}
          firstPendingIndex={0}
          onMark={noop as unknown as (i: number, s: string, v: 'success' | 'fail') => void}
          onUndo={noop as unknown as (i: number, s: string) => void}
          onSetAmrapReps={noop as unknown as (i: number, s: string, r: number | undefined) => void}
          onSetRpe={noop as unknown as (i: number, s: string, r: number | undefined) => void}
        />
      );

      const dayHeaderCells = container.querySelectorAll('td[colspan]');
      expect(dayHeaderCells.length).toBeGreaterThan(0);
      expect(dayHeaderCells[0].getAttribute('colspan')).toBe('8');
    });
  });
});
