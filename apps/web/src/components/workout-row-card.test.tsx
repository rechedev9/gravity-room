import { describe, it, expect, mock } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { WorkoutRowCard } from './workout-row-card';
import type { WorkoutRow as WorkoutRowType, Tier, ResultValue } from '@gzclp/shared/types';

// ---------------------------------------------------------------------------
// WorkoutRowCard — class hierarchy and ARIA tests (REQ-CARD-001, REQ-CARD-004)
// ---------------------------------------------------------------------------

function buildRow(overrides?: Partial<WorkoutRowType>): WorkoutRowType {
  return {
    index: 0,
    dayName: 'Día 1',
    t1Exercise: 'squat',
    t1Weight: 60,
    t1Stage: 0,
    t1Sets: 5,
    t1Reps: 3,
    t2Exercise: 'bench',
    t2Weight: 40,
    t2Stage: 0,
    t2Sets: 3,
    t2Reps: 10,
    t3Exercise: 'latpulldown',
    t3Weight: 30,
    isChanged: false,
    result: {},
    ...overrides,
  };
}

function renderCard(overrides?: Partial<WorkoutRowType>): ReturnType<typeof render> {
  const onMark = mock<(index: number, tier: Tier, value: ResultValue) => void>();
  const onSetAmrapReps =
    mock<(index: number, field: 't1Reps' | 't3Reps', reps: number | undefined) => void>();
  const onUndo = mock<(index: number, tier: Tier) => void>();

  return render(
    <WorkoutRowCard
      row={buildRow(overrides)}
      isCurrent={false}
      onMark={onMark}
      onSetAmrapReps={onSetAmrapReps}
      onUndo={onUndo}
    />
  );
}

describe('WorkoutRowCard', () => {
  describe('T1 tier visual hierarchy (REQ-CARD-001, REQ-CARD-002)', () => {
    it('should render T1 label with fill-progress color class', () => {
      const { container } = renderCard();

      const t1Section = container.querySelector('[data-testid="t1-result-0"]');
      const t1Label = t1Section?.querySelector('.text-xs');

      expect(t1Label?.className).toContain('text-[var(--fill-progress)]');
    });

    it('should render T1 weight with font-display-data class', () => {
      const { container } = renderCard();

      const t1Section = container.querySelector('[data-testid="t1-result-0"]');
      // The weight element has font-display-data for T1
      const weightEl = t1Section?.querySelector('.font-display-data');

      expect(weightEl).not.toBeNull();
    });

    it('should render T1 weight with fill-progress color', () => {
      const { container } = renderCard();

      const t1Section = container.querySelector('[data-testid="t1-result-0"]');
      const weightEl = t1Section?.querySelector('.font-display-data');

      expect(weightEl?.className).toContain('text-[var(--fill-progress)]');
    });
  });

  describe('card header workout number (REQ-CARD-004)', () => {
    it('should render #N header with font-display class', () => {
      const { container } = renderCard({ index: 4 });

      const header = container.querySelector('.font-display');

      expect(header).not.toBeNull();
      expect(header?.textContent).toContain('#5');
    });

    it('should render workout number as text-2xl', () => {
      const { container } = renderCard({ index: 0 });

      const header = container.querySelector('.font-display.text-2xl');

      expect(header).not.toBeNull();
    });
  });

  describe('RPE aria-labels (REQ-CARD-004)', () => {
    it('should render success and fail buttons with aria-labels for T1', () => {
      renderCard();

      // Result buttons for unmarked tiers should have aria-labels
      const successButtons = screen.getAllByRole('button', { name: /éxito/i });
      expect(successButtons.length).toBeGreaterThan(0);
    });

    it('should render RPE buttons with aria-label="RPE {n}" when T1 is marked and onSetRpe is provided', () => {
      const onSetRpe = mock<(index: number, rpe: number | undefined) => void>();
      const onMark = mock<(index: number, tier: Tier, value: ResultValue) => void>();
      const onSetAmrapReps =
        mock<(index: number, field: 't1Reps' | 't3Reps', reps: number | undefined) => void>();
      const onUndo = mock<(index: number, tier: Tier) => void>();

      render(
        <WorkoutRowCard
          row={buildRow({ result: { t1: 'success' } })}
          isCurrent={false}
          onMark={onMark}
          onSetAmrapReps={onSetAmrapReps}
          onUndo={onUndo}
          onSetRpe={onSetRpe}
        />
      );

      const rpe6Button = screen.getByRole('button', { name: 'RPE 6' });
      expect(rpe6Button).not.toBeNull();
    });
  });
});
