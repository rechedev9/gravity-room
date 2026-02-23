import { describe, it, expect, mock } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { WorkoutRow } from './workout-row';
import type { WorkoutRow as WorkoutRowType } from '@gzclp/shared/types';

// ---------------------------------------------------------------------------
// WorkoutRow — behavioral integration tests
// ---------------------------------------------------------------------------

function buildRow(overrides?: Partial<WorkoutRowType>): WorkoutRowType {
  return {
    index: 0,
    dayName: 'Day 1',
    t1Exercise: 'squat',
    t1Weight: 60,
    t1Stage: 0,
    t1Sets: 5,
    t1Reps: 3,
    t2Exercise: 'bench',
    t2Weight: 26,
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

function renderRow(
  rowOverrides?: Partial<WorkoutRowType>,
  props?: {
    isCurrent?: boolean;
    onMark?: ReturnType<typeof mock>;
    onSetAmrapReps?: ReturnType<typeof mock>;
    onUndo?: ReturnType<typeof mock>;
  }
) {
  const onMark = props?.onMark ?? mock();
  const onSetAmrapReps = props?.onSetAmrapReps ?? mock();
  const onUndo = props?.onUndo ?? mock();
  const row = buildRow(rowOverrides);

  // WorkoutRow renders a <tr>, so wrap in a table
  const result = render(
    <table>
      <tbody>
        <WorkoutRow
          row={row}
          isCurrent={props?.isCurrent ?? false}
          onMark={onMark}
          onSetAmrapReps={onSetAmrapReps}
          onUndo={onUndo}
        />
      </tbody>
    </table>
  );

  return { ...result, onMark, onSetAmrapReps, onUndo, row };
}

describe('WorkoutRow', () => {
  describe('rendering', () => {
    it('should display workout number (1-indexed)', () => {
      renderRow({ index: 0 });

      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('should display day name', () => {
      renderRow({ dayName: 'Día 1' });

      expect(screen.getByText('Día 1')).toBeInTheDocument();
    });

    it('should display exercise names', () => {
      renderRow();

      expect(screen.getByText('Sentadilla')).toBeInTheDocument();
      expect(screen.getByText('Press Banca')).toBeInTheDocument();
      expect(screen.getByText('Jalón al Pecho')).toBeInTheDocument();
    });

    it('should display weights', () => {
      renderRow({ t1Weight: 60, t2Weight: 26, t3Weight: 30 });

      expect(screen.getByText('60')).toBeInTheDocument();
    });

    it('should display sets x reps for T1 and T2', () => {
      renderRow({ t1Sets: 5, t1Reps: 3, t2Sets: 3, t2Reps: 10 });

      // The × character is rendered as HTML entity
      const cells = screen.getAllByText(/×/);
      expect(cells.length).toBeGreaterThanOrEqual(2);
    });

    it('should render StageTag for T1 and T2', () => {
      renderRow({ t1Stage: 0, t2Stage: 1 });

      expect(screen.getByText('S1')).toBeInTheDocument();
      expect(screen.getByText('S2')).toBeInTheDocument();
    });
  });

  describe('result buttons', () => {
    it('should show success and fail buttons for unmarked tiers', () => {
      renderRow();

      // Each unmarked tier shows ✓ and ✗ buttons (3 tiers × 2 buttons = 6)
      const checkButtons = screen.getAllByText('✓');
      const crossButtons = screen.getAllByText('✗');
      expect(checkButtons).toHaveLength(3);
      expect(crossButtons).toHaveLength(3);
    });

    it('should call onMark with success when ✓ is clicked', () => {
      const onMark = mock();
      renderRow({ index: 2 }, { onMark });

      // Click the first ✓ button (T1)
      const checkButtons = screen.getAllByText('✓');
      fireEvent.click(checkButtons[0]);

      expect(onMark).toHaveBeenCalledWith(2, 't1', 'success');
    });

    it('should call onMark with fail when ✗ is clicked', () => {
      const onMark = mock();
      renderRow({ index: 3 }, { onMark });

      // Click the first ✗ button (T1)
      const crossButtons = screen.getAllByText('✗');
      fireEvent.click(crossButtons[0]);

      expect(onMark).toHaveBeenCalledWith(3, 't1', 'fail');
    });
  });

  describe('marked results', () => {
    it('should show ✓ badge for success result', () => {
      renderRow({ result: { t1: 'success' } });

      // The marked T1 shows a single ✓ as badge (not a button pair)
      // Plus 2 unmarked tiers × 1 ✓ button each = 3 total ✓
      const checks = screen.getAllByText('✓');
      expect(checks.length).toBe(3);
    });

    it('should show ✗ badge for fail result', () => {
      renderRow({ result: { t1: 'fail' } });

      // 1 fail badge + 2 unmarked ✗ buttons = 3
      const crosses = screen.getAllByText('✗');
      expect(crosses.length).toBe(3);
    });

    it('should call onUndo when a result badge is clicked', () => {
      const onUndo = mock();
      renderRow({ index: 1, result: { t1: 'success' } }, { onUndo });

      // The result badge for T1 contains ✓ — it's a button that calls onUndo
      // Find the ✓ that has "undo" tooltip nearby
      const checks = screen.getAllByText('✓');
      // The first ✓ is the result badge (button with undo tooltip)
      fireEvent.click(checks[0]);

      expect(onUndo).toHaveBeenCalledWith(1, 't1');
    });
  });

  describe('AMRAP input', () => {
    it('should show AMRAP input when T1 is marked', () => {
      renderRow({ result: { t1: 'success' } });

      expect(screen.getByText('T1 AMRAP')).toBeInTheDocument();
    });

    it('should not show AMRAP input when T1 is unmarked', () => {
      renderRow({ result: {} });

      expect(screen.queryByText('AMRAP')).not.toBeInTheDocument();
    });

    it('should call onSetAmrapReps when AMRAP value changes', () => {
      const onSetAmrapReps = mock();
      renderRow({ index: 0, result: { t1: 'success' } }, { onSetAmrapReps });

      const amrapInputs = screen.getAllByTitle('Reps AMRAP');
      fireEvent.change(amrapInputs[0], { target: { value: '8' } });

      expect(onSetAmrapReps).toHaveBeenCalledWith(0, 't1Reps', 8);
    });

    it('should call onSetAmrapReps with t3Reps when T3 AMRAP value changes', () => {
      const onSetAmrapReps = mock();
      renderRow({ index: 0, result: { t3: 'success' } }, { onSetAmrapReps });

      const amrapInputs = screen.getAllByTitle('Reps AMRAP');
      fireEvent.change(amrapInputs[0], { target: { value: '12' } });

      expect(onSetAmrapReps).toHaveBeenCalledWith(0, 't3Reps', 12);
    });

    it('should show AMRAP input for T3 when marked', () => {
      renderRow({ result: { t3: 'success' } });

      expect(screen.getByText('T3 AMRAP')).toBeInTheDocument();
    });
  });

  describe('row styling', () => {
    it('should add data-current-row attribute when isCurrent', () => {
      renderRow({}, { isCurrent: true });

      const row = document.querySelector('[data-current-row]');
      expect(row).not.toBeNull();
    });

    it('should not add data-current-row when not current', () => {
      renderRow({}, { isCurrent: false });

      const row = document.querySelector('[data-current-row]');
      expect(row).toBeNull();
    });
  });

  describe('detail sub-row', () => {
    it('should render detail sub-row when T1 is marked', () => {
      const { container } = renderRow({ result: { t1: 'success' } });

      const rows = container.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(2);
      expect(screen.getByText('T1 AMRAP')).toBeInTheDocument();
    });

    it('should render detail sub-row when only T3 is marked', () => {
      const { container } = renderRow({ result: { t3: 'success' } });

      const rows = container.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(2);
      expect(screen.getByText('T3 AMRAP')).toBeInTheDocument();
      expect(screen.queryByText('T1 AMRAP')).not.toBeInTheDocument();
    });

    it('should render both T1 and T3 AMRAP in a single sub-row when both are marked', () => {
      const { container } = renderRow({ result: { t1: 'success', t3: 'success' } });

      const rows = container.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(2);
      expect(screen.getByText('T1 AMRAP')).toBeInTheDocument();
      expect(screen.getByText('T3 AMRAP')).toBeInTheDocument();
    });

    it('should not render detail sub-row when no tiers are marked', () => {
      const { container } = renderRow({ result: {} });

      const rows = container.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(1);
    });

    it('should not render detail sub-row when only T2 is marked', () => {
      const { container } = renderRow({ result: { t2: 'success' } });

      const rows = container.querySelectorAll('tbody tr');
      expect(rows).toHaveLength(1);
    });

    it('should render RPE input in sub-row when T1 is marked and onSetRpe is provided', () => {
      const onSetRpe = mock();
      const onMark = mock();
      const onSetAmrapReps = mock();
      const onUndo = mock();
      const row = buildRow({ result: { t1: 'success' } });

      render(
        <table>
          <tbody>
            <WorkoutRow
              row={row}
              isCurrent={false}
              onMark={onMark}
              onSetAmrapReps={onSetAmrapReps}
              onUndo={onUndo}
              onSetRpe={onSetRpe}
            />
          </tbody>
        </table>
      );

      const rpeButtons = screen.getAllByRole('button', { name: /RPE/i });
      expect(rpeButtons.length).toBeGreaterThan(0);
    });

    it('should not render RPE input in sub-row when onSetRpe is not provided', () => {
      renderRow({ result: { t1: 'success' } });

      const rpeButtons = screen.queryAllByRole('button', { name: /RPE/i });
      expect(rpeButtons).toHaveLength(0);
    });

    it('should not render RPE input when only T3 is marked and onSetRpe is provided', () => {
      const onSetRpe = mock();
      const onMark = mock();
      const onSetAmrapReps = mock();
      const onUndo = mock();
      const row = buildRow({ result: { t3: 'success' } });

      render(
        <table>
          <tbody>
            <WorkoutRow
              row={row}
              isCurrent={false}
              onMark={onMark}
              onSetAmrapReps={onSetAmrapReps}
              onUndo={onUndo}
              onSetRpe={onSetRpe}
            />
          </tbody>
        </table>
      );

      const rpeButtons = screen.queryAllByRole('button', { name: /RPE/i });
      expect(rpeButtons).toHaveLength(0);
    });
  });
});
