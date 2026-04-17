import { describe, it, expect, mock } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { WeightField } from './weight-field';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildProps(overrides?: Partial<Parameters<typeof WeightField>[0]>) {
  return {
    fieldKey: 'squat',
    label: 'Sentadilla',
    value: '60',
    touched: false,
    fieldError: null,
    step: 2.5,
    min: 20,
    onChange: mock(),
    onBlur: mock(),
    onAdjust: mock(),
    onSubmit: mock(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests (REQ-CCF-002, REQ-CCF-003)
// ---------------------------------------------------------------------------

describe('WeightField', () => {
  describe('min attribute (REQ-CCF-002)', () => {
    it('should set min="20" on the input when rendered with min={20}', () => {
      render(<WeightField {...buildProps({ min: 20 })} />);

      const input = screen.getByRole('spinbutton');

      expect(input.getAttribute('min')).toBe('20');
    });

    it('should set min="5" on the input when rendered with min={5}', () => {
      render(<WeightField {...buildProps({ min: 5 })} />);

      const input = screen.getByRole('spinbutton');

      expect(input.getAttribute('min')).toBe('5');
    });
  });

  describe('hint text (REQ-CCF-003)', () => {
    it('should show "Mín 20 kg" when untouched and no error', () => {
      render(<WeightField {...buildProps({ min: 20, touched: false, fieldError: null })} />);

      expect(screen.getByText('Mín 20 kg')).toBeInTheDocument();
    });

    it('should show error message instead of hint when touched and error is set', () => {
      render(
        <WeightField
          {...buildProps({ min: 20, touched: true, fieldError: 'El peso es demasiado bajo' })}
        />
      );

      expect(screen.getByRole('alert').textContent).toContain('El peso es demasiado bajo');
      expect(screen.queryByText('Mín 20 kg')).not.toBeInTheDocument();
    });
  });
});
