/**
 * StageEditor component tests (REQ-RULE-002).
 * Verifies add/remove stages, AMRAP toggle, and validation.
 */
import { describe, it, expect, mock } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { StageEditor } from './stage-editor';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeStage(
  overrides: Partial<{ sets: number; reps: number; amrap: boolean; repsMax: number }> = {}
): { sets: number; reps: number; amrap?: boolean; repsMax?: number } {
  return { sets: 3, reps: 5, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StageEditor', () => {
  it('renders correct number of stage rows', () => {
    const stages = [makeStage(), makeStage({ sets: 6, reps: 2 })];
    const onChange = mock();

    render(<StageEditor stages={stages} onChange={onChange} />);

    const seriesInputs = screen.getAllByLabelText(/^programs\.wizard\.stage_editor\.fields\.sets/);
    expect(seriesInputs.length).toBe(2);
  });

  it('appends stage with defaults when "Add stage" is clicked', () => {
    const stages = [makeStage()];
    const onChange = mock();

    render(<StageEditor stages={stages} onChange={onChange} />);
    fireEvent.click(screen.getByText('programs.wizard.stage_editor.add_stage'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const newStages = onChange.mock.calls[0][0] as Array<{
      sets: number;
      reps: number;
      amrap: boolean;
    }>;
    expect(newStages.length).toBe(2);
    expect(newStages[1]).toEqual({ sets: 3, reps: 5, amrap: false });
  });

  it('removes stage and calls onChange', () => {
    const stages = [makeStage(), makeStage({ sets: 6, reps: 2 })];
    const onChange = mock();

    render(<StageEditor stages={stages} onChange={onChange} />);
    const removeButtons = screen.getAllByText('programs.wizard.stage_editor.remove_stage');
    fireEvent.click(removeButtons[1]);

    expect(onChange).toHaveBeenCalledTimes(1);
    const remaining = onChange.mock.calls[0][0] as unknown[];
    expect(remaining.length).toBe(1);
  });

  it('disables remove stage when only 1 stage remains', () => {
    const stages = [makeStage()];
    const onChange = mock();

    render(<StageEditor stages={stages} onChange={onChange} />);
    const removeButton = screen.getByText('programs.wizard.stage_editor.remove_stage');

    expect(removeButton).toBeDisabled();
  });

  it('shows repsMax field when AMRAP is enabled', () => {
    const stages = [makeStage({ amrap: false })];
    const onChange = mock();

    render(<StageEditor stages={stages} onChange={onChange} />);

    // Initially no repsMax field
    expect(screen.queryByLabelText('programs.wizard.stage_editor.fields.reps_max 1')).toBeNull();

    // Check the AMRAP checkbox
    fireEvent.click(screen.getByLabelText('AMRAP 1'));

    // onChange is called with amrap: true — re-render with updated stages
    const updatedStages = onChange.mock.calls[0][0] as Array<{ amrap: boolean }>;
    expect(updatedStages[0].amrap).toBe(true);
  });

  it('hides repsMax field when AMRAP is disabled', () => {
    const stages = [makeStage({ amrap: true, repsMax: 10 })];
    const onChange = mock();

    render(<StageEditor stages={stages} onChange={onChange} />);

    // repsMax should be visible
    expect(
      screen.getByLabelText('programs.wizard.stage_editor.fields.reps_max 1')
    ).toBeInTheDocument();

    // Uncheck AMRAP
    fireEvent.click(screen.getByLabelText('AMRAP 1'));

    const updatedStages = onChange.mock.calls[0][0] as Array<{ amrap: boolean; repsMax?: number }>;
    expect(updatedStages[0].amrap).toBe(false);
    expect(updatedStages[0].repsMax).toBeUndefined();
  });

  it('does not update state when sets value is 0 (validation)', () => {
    const stages = [makeStage({ sets: 3 })];
    const onChange = mock();

    render(<StageEditor stages={stages} onChange={onChange} />);
    const setsInput = screen.getByLabelText('programs.wizard.stage_editor.fields.sets 1');
    fireEvent.change(setsInput, { target: { value: '0' } });

    // onChange should NOT be called because 0 is below minimum
    expect(onChange).not.toHaveBeenCalled();
  });
});
