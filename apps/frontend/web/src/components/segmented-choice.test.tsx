import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SegmentedChoice } from './segmented-choice';

const OPTIONS = [
  { value: 'kg', label: 'kg' },
  { value: 'lb', label: 'lb' },
] as const;

describe('SegmentedChoice', () => {
  it('renders a labelled radiogroup with the current value checked', () => {
    render(
      <SegmentedChoice label="Units" value="kg" options={OPTIONS} onChange={() => undefined} />
    );
    expect(screen.getByRole('radiogroup', { name: 'Units' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'kg' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'lb' })).not.toBeChecked();
  });

  it('reports the chosen value on click', () => {
    const onChange = vi.fn();
    render(<SegmentedChoice label="Units" value="kg" options={OPTIONS} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'lb' }));
    expect(onChange).toHaveBeenCalledWith('lb');
  });

  it('moves the selection with the arrow keys and wraps around', () => {
    const onChange = vi.fn();
    render(<SegmentedChoice label="Units" value="lb" options={OPTIONS} onChange={onChange} />);
    screen.getByRole('radio', { name: 'lb' }).focus();
    fireEvent.keyDown(screen.getByRole('radio', { name: 'lb' }), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('kg');
  });

  it('only the checked segment is in the tab order', () => {
    render(
      <SegmentedChoice label="Units" value="kg" options={OPTIONS} onChange={() => undefined} />
    );
    expect(screen.getByRole('radio', { name: 'kg' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('radio', { name: 'lb' })).toHaveAttribute('tabindex', '-1');
  });
});
