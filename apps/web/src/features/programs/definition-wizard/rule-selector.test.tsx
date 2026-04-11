/**
 * RuleSelector component tests (REQ-RULE-003).
 * Verifies dropdown options, conditional param fields, and onChange callbacks.
 */
import { describe, it, expect, mock } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { RuleSelector } from './rule-selector';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RuleSelector', () => {
  it('renders dropdown with all 6 standard rule type options', () => {
    const onChange = mock();

    render(<RuleSelector label="Al completar" rule={{ type: 'add_weight' }} onChange={onChange} />);

    const select = screen.getByLabelText('Al completar') as HTMLSelectElement;
    const options = Array.from(select.querySelectorAll('option'));
    const values = options.map((o) => o.value);

    expect(values).toContain('add_weight');
    expect(values).toContain('advance_stage');
    expect(values).toContain('add_weight_reset_stage');
    expect(values).toContain('deload_percent');
    expect(values).toContain('no_change');
    expect(values).toContain('double_progression');
    expect(options.length).toBe(6);
  });

  it('shows percent field pre-filled with 10 when deload_percent is selected', () => {
    const onChange = mock();

    render(
      <RuleSelector
        label="Al fallar"
        rule={{ type: 'deload_percent', percent: 10 }}
        onChange={onChange}
      />
    );

    const percentInput = screen.getByLabelText(
      'programs.wizard.deload_percent_label'
    ) as HTMLInputElement;
    expect(percentInput.value).toBe('10');
  });

  it('hides all param fields when no_change is selected', () => {
    const onChange = mock();

    render(<RuleSelector label="Al completar" rule={{ type: 'no_change' }} onChange={onChange} />);

    expect(screen.queryByLabelText('programs.wizard.deload_percent_label')).toBeNull();
    expect(screen.queryByLabelText('programs.wizard.add_weight_amount_label')).toBeNull();
    expect(screen.queryByLabelText('programs.wizard.min_reps_label')).toBeNull();
    expect(screen.queryByLabelText('programs.wizard.max_reps_label')).toBeNull();
  });

  it('shows amount field when add_weight_reset_stage is selected', () => {
    const onChange = mock();

    render(
      <RuleSelector
        label="Al fallar"
        rule={{ type: 'add_weight_reset_stage', amount: 2.5 }}
        onChange={onChange}
      />
    );

    expect(screen.getByLabelText('programs.wizard.add_weight_amount_label')).toBeInTheDocument();
  });

  it('shows repRangeBottom and repRangeTop fields when double_progression is selected', () => {
    const onChange = mock();

    render(
      <RuleSelector
        label="Al completar"
        rule={{ type: 'double_progression', repRangeBottom: 8, repRangeTop: 12 }}
        onChange={onChange}
      />
    );

    expect(screen.getByLabelText('programs.wizard.min_reps_label')).toBeInTheDocument();
    expect(screen.getByLabelText('programs.wizard.max_reps_label')).toBeInTheDocument();
  });

  it('calls onChange with correct rule shape when dropdown changes', () => {
    const onChange = mock();

    render(<RuleSelector label="Al completar" rule={{ type: 'add_weight' }} onChange={onChange} />);

    const select = screen.getByLabelText('Al completar');
    fireEvent.change(select, { target: { value: 'deload_percent' } });

    expect(onChange).toHaveBeenCalledTimes(1);
    const newRule = onChange.mock.calls[0][0] as { type: string; percent?: number };
    expect(newRule.type).toBe('deload_percent');
    expect(newRule.percent).toBe(10);
  });
});
