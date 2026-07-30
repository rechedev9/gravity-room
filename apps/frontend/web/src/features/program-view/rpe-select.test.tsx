import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RpeSelect } from './rpe-select';

describe('RpeSelect', () => {
  it('uses a custom listbox trigger, not a native select', () => {
    render(<RpeSelect value={undefined} onChange={vi.fn()} workoutIndex={0} slotKey="d1-t1" />);

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(document.querySelector('select')).toBeNull();
    expect(screen.getByTestId('rpe-select-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('rpe-select-trigger').tagName).toBe('BUTTON');
  });

  it('opens a listbox and commits the chosen RPE', () => {
    const onChange = vi.fn();
    render(<RpeSelect value={undefined} onChange={onChange} workoutIndex={0} slotKey="d1-t1" />);

    fireEvent.click(screen.getByTestId('rpe-select-trigger'));
    expect(screen.getByTestId('rpe-select-listbox')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('rpe-option-8'));
    expect(onChange).toHaveBeenCalledWith(8);
    expect(screen.queryByTestId('rpe-select-listbox')).not.toBeInTheDocument();
  });

  it('can clear a previously selected RPE', () => {
    const onChange = vi.fn();
    render(<RpeSelect value={7} onChange={onChange} workoutIndex={1} slotKey="d1-t1" />);

    expect(screen.getByTestId('rpe-select-trigger')).toHaveTextContent(/RPE 7/);
    fireEvent.click(screen.getByTestId('rpe-select-trigger'));
    fireEvent.click(screen.getByTestId('rpe-option-none'));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
