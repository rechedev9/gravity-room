import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { WeightField } from './weight-field';

afterEach(() => {
  localStorage.clear();
});

function renderField(initial: string, onChange = vi.fn()): ReturnType<typeof vi.fn> {
  function Harness(): React.ReactNode {
    const [value, setValue] = useState(initial);
    return (
      <WeightField
        fieldKey="squat"
        label="Squat"
        value={value}
        touched={false}
        fieldError={null}
        step={2.5}
        min={2.5}
        onChange={(key, v) => {
          onChange(key, v);
          setValue(v);
        }}
        onBlur={vi.fn()}
        onAdjust={vi.fn()}
        onSubmit={vi.fn()}
      />
    );
  }
  render(<Harness />);
  return onChange;
}

describe('WeightField', () => {
  it('shows the stored kg value in lbs and reports typed lbs back as kg', () => {
    localStorage.setItem('gravity-room:unit-preference', 'lbs');
    const onChange = renderField('100');
    const input = screen.getByRole('spinbutton');
    expect((input as HTMLInputElement).value).toBe('220.46');

    fireEvent.change(input, { target: { value: '135' } });

    expect(onChange).toHaveBeenCalledWith('squat', '61.24');
    expect((input as HTMLInputElement).value).toBe('135');
  });

  it('is a plain pass-through in kg', () => {
    const onChange = renderField('60');
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '62.5' } });
    expect(onChange).toHaveBeenCalledWith('squat', '62.5');
  });
});
