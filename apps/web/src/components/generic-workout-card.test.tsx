import { describe, it, expect, mock } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { GenericWorkoutCard } from './generic-workout-card';
import type { GenericWorkoutRow, GenericSlotRow, ResultValue } from '@gzclp/shared/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSlot(overrides?: Partial<GenericSlotRow>): GenericSlotRow {
  return {
    slotId: 'slot-t1',
    exerciseId: 'squat',
    exerciseName: 'Sentadilla',
    tier: 't1',
    weight: 60,
    stage: 0,
    sets: 5,
    reps: 3,
    repsMax: undefined,
    isAmrap: false,
    result: undefined,
    amrapReps: undefined,
    rpe: undefined,
    isChanged: false,
    role: 'primary',
    ...overrides,
  };
}

function buildRow(overrides?: Partial<GenericWorkoutRow>): GenericWorkoutRow {
  return {
    index: 0,
    dayName: 'Día 1',
    isChanged: false,
    slots: [
      buildSlot(),
      buildSlot({
        slotId: 'slot-t2',
        exerciseId: 'bench',
        exerciseName: 'Press Banca',
        tier: 't2',
        weight: 40,
        sets: 3,
        reps: 10,
        role: 'secondary',
      }),
    ],
    ...overrides,
  };
}

function renderCard(
  overrides?: Partial<GenericWorkoutRow>,
  options?: { onSetRpe?: (workoutIndex: number, slotId: string, rpe: number | undefined) => void }
): ReturnType<typeof render> {
  const onMark = mock<(workoutIndex: number, slotId: string, value: ResultValue) => void>();
  const onSetAmrapReps =
    mock<(workoutIndex: number, slotId: string, reps: number | undefined) => void>();
  const onUndo = mock<(workoutIndex: number, slotId: string) => void>();

  return render(
    <GenericWorkoutCard
      row={buildRow(overrides)}
      isCurrent={false}
      onMark={onMark}
      onSetAmrapReps={onSetAmrapReps}
      onSetRpe={options?.onSetRpe}
      onUndo={onUndo}
    />
  );
}

// ---------------------------------------------------------------------------
// GenericWorkoutCard — tests
// ---------------------------------------------------------------------------

describe('GenericWorkoutCard', () => {
  describe('T1 weight hero treatment (REQ-CARD-003)', () => {
    it('should render T1 weight with font-display-data class', () => {
      const { container } = renderCard();

      const weightEl = container.querySelector('.font-display-data');

      expect(weightEl).not.toBeNull();
    });

    it('should render T1 weight with fill-progress color class', () => {
      const { container } = renderCard();

      const weightEl = container.querySelector('.font-display-data');

      expect(weightEl?.className).toContain('text-[var(--fill-progress)]');
    });

    it('should NOT render T2 weight with font-display-data class', () => {
      const { container } = renderCard();

      // Only 1 weight element should have font-display-data (the T1 one)
      const displayDataEls = container.querySelectorAll('.font-display-data');

      expect(displayDataEls.length).toBe(1);
    });
  });

  describe('card header workout number (REQ-CARD-004)', () => {
    it('should render #N header with font-display class', () => {
      const { container } = renderCard({ index: 2 });

      const header = container.querySelector('.font-display.text-2xl');

      expect(header).not.toBeNull();
      expect(header?.textContent).toContain('#3');
    });
  });

  describe('ARIA labels (REQ-CARD-004)', () => {
    it('should render success buttons with accessible role', () => {
      renderCard();

      const successButtons = screen.getAllByRole('button', { name: /éxito/i });

      expect(successButtons.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Role-based CSS styling (REQ-UI-003)
  // ---------------------------------------------------------------------------

  describe('role-based weight styling (REQ-UI-003)', () => {
    it('primary role slot renders with font-display-data text-3xl class', () => {
      const { container } = renderCard({
        slots: [buildSlot({ role: 'primary', weight: 100 })],
      });

      const weightEl = container.querySelector('.font-display-data');

      expect(weightEl).not.toBeNull();
      expect(weightEl?.className).toContain('text-3xl');
    });

    it('secondary role slot does NOT have text-3xl class', () => {
      const { container } = renderCard({
        slots: [buildSlot({ slotId: 's2', role: 'secondary', weight: 80 })],
      });

      const weightEl = container.querySelector('.text-3xl');

      expect(weightEl).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Role-based RPE input gating (REQ-UI-001)
  // ---------------------------------------------------------------------------

  describe('role-based RPE input gating (REQ-UI-001)', () => {
    it('RPE input present for role: primary with result: success', () => {
      const onSetRpe =
        mock<(workoutIndex: number, slotId: string, rpe: number | undefined) => void>();

      const { container } = renderCard(
        {
          slots: [buildSlot({ role: 'primary', result: 'success' })],
        },
        { onSetRpe }
      );

      const rpeInput = container.querySelector('[data-rpe-input]');

      expect(rpeInput).not.toBeNull();
    });

    it('RPE input absent for role: secondary even with result: success', () => {
      const onSetRpe =
        mock<(workoutIndex: number, slotId: string, rpe: number | undefined) => void>();

      const { container } = renderCard(
        {
          slots: [buildSlot({ slotId: 's2', role: 'secondary', result: 'success' })],
        },
        { onSetRpe }
      );

      const rpeInput = container.querySelector('[data-rpe-input]');

      expect(rpeInput).toBeNull();
    });

    it('RPE input absent for role: accessory even with result: success', () => {
      const onSetRpe =
        mock<(workoutIndex: number, slotId: string, rpe: number | undefined) => void>();

      const { container } = renderCard(
        {
          slots: [
            buildSlot({
              slotId: 'acc1',
              tier: 'accessory',
              role: 'accessory',
              result: 'success',
            }),
          ],
        },
        { onSetRpe }
      );

      const rpeInput = container.querySelector('[data-rpe-input]');

      expect(rpeInput).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // repsMax display (REQ-UI-006)
  // ---------------------------------------------------------------------------

  describe('repsMax display (REQ-UI-006)', () => {
    it('renders rep range 3x8-10 when repsMax is 10', () => {
      const { container } = renderCard({
        slots: [
          buildSlot({
            slotId: 'acc1',
            tier: 'accessory',
            role: 'accessory',
            sets: 3,
            reps: 8,
            repsMax: 10,
            weight: 20,
          }),
        ],
      });

      const repText = container.querySelector('.text-\\[12px\\]');

      expect(repText?.textContent).toContain('3');
      expect(repText?.textContent).toContain('8');
      expect(repText?.textContent).toContain('-10');
    });

    it('renders single rep 3x5 without range when repsMax is undefined', () => {
      const { container } = renderCard({
        slots: [buildSlot({ sets: 3, reps: 5, repsMax: undefined, weight: 60 })],
      });

      const repText = container.querySelector('.text-\\[12px\\]');

      expect(repText?.textContent).toContain('3');
      expect(repText?.textContent).toContain('5');
      expect(repText?.textContent).not.toContain('-');
    });
  });
});
