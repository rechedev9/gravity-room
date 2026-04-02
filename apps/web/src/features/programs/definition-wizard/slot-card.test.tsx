/**
 * SlotCard component tests (REQ-RULE-001, REQ-RULE-004, REQ-RULE-005, REQ-RULE-006).
 * Verifies accordion behavior, template selection, and advanced toggle.
 */
import { describe, it, expect, mock } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { SlotCard } from './slot-card';
import type { SlotEditorState } from './types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeSlot(overrides: Partial<SlotEditorState> = {}): SlotEditorState {
  return {
    dayIndex: 0,
    slotIndex: 0,
    slotId: 'd1-t1',
    exerciseName: 'Sentadilla',
    stages: [{ sets: 5, reps: 3 }],
    onSuccess: { type: 'add_weight' },
    onMidStageFail: { type: 'advance_stage' },
    onFinalStageFail: { type: 'deload_percent', percent: 10 },
    onFinalStageSuccess: undefined,
    onUndefined: undefined,
    showAdvanced: false,
    templateId: 'linear',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SlotCard', () => {
  it('renders exercise name in accordion header', () => {
    const onChange = mock();

    render(<SlotCard slot={makeSlot()} onChange={onChange} />);

    expect(screen.getByText('Sentadilla')).toBeInTheDocument();
  });

  it('shows accordion body after clicking header', () => {
    const onChange = mock();

    render(<SlotCard slot={makeSlot()} onChange={onChange} />);

    // Body is initially collapsed (no defaultOpen)
    expect(screen.queryByText('Etapas')).toBeNull();

    // Click header to expand
    fireEvent.click(screen.getByText('Sentadilla'));

    // Body should now be visible (StageEditor renders "Etapas" label)
    expect(screen.getByText('Etapas')).toBeInTheDocument();
  });

  it('shows additional rule selectors when "Avanzado" toggle is clicked', () => {
    const onChange = mock();

    render(<SlotCard slot={makeSlot()} onChange={onChange} defaultOpen />);

    // Advanced section should be collapsed by default
    expect(screen.queryByText('Ultra-avanzado')).toBeNull();

    // Click "Avanzado" toggle
    const advancedButton = screen.getByRole('button', { name: /Avanzado/ });
    fireEvent.click(advancedButton);

    // Now Ultra-avanzado section should be visible
    expect(screen.getByText('Ultra-avanzado')).toBeInTheDocument();
    expect(screen.getByText('Al completar la ultima etapa')).toBeInTheDocument();
    expect(screen.getByText('Sin resultado definido')).toBeInTheDocument();
  });

  it('does not clear advanced rule values when collapsing "Avanzado"', () => {
    const onChange = mock();

    // Slot already has onFinalStageSuccess set
    const slot = makeSlot({
      showAdvanced: true,
      onFinalStageSuccess: { type: 'no_change' },
    });

    render(<SlotCard slot={slot} onChange={onChange} defaultOpen />);

    // Click "Avanzado" to collapse
    const advancedButton = screen.getByRole('button', { name: /Avanzado/ });
    fireEvent.click(advancedButton);

    // The onChange should be called with showAdvanced: false but onFinalStageSuccess preserved
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1] as [SlotEditorState];
    expect(lastCall[0].showAdvanced).toBe(false);
    expect(lastCall[0].onFinalStageSuccess).toEqual({ type: 'no_change' });
  });

  it('template selection overwrites stages and standard rules but NOT advanced rules', () => {
    const onChange = mock();

    const slot = makeSlot({
      onFinalStageSuccess: { type: 'no_change' },
      onUndefined: { type: 'advance_stage' },
    });

    render(<SlotCard slot={slot} onChange={onChange} defaultOpen />);

    // Select "Doble Progresion" template
    const templateSelect = screen.getByLabelText(/Plantilla para Sentadilla/);
    fireEvent.change(templateSelect, { target: { value: 'double-progression' } });

    expect(onChange).toHaveBeenCalled();
    const updated = onChange.mock.calls[onChange.mock.calls.length - 1][0] as SlotEditorState;

    // Standard rules should be overwritten by template
    expect(updated.onSuccess.type).toBe('double_progression');
    expect(updated.templateId).toBe('double-progression');

    // Advanced rules should be preserved
    expect(updated.onFinalStageSuccess).toEqual({ type: 'no_change' });
    expect(updated.onUndefined).toEqual({ type: 'advance_stage' });
  });
});
