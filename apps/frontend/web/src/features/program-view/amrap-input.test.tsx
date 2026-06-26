import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AmrapInput } from './amrap-input';

// ---------------------------------------------------------------------------
// AmrapInput — display and interaction tests (REQ-TIF-001)
// ---------------------------------------------------------------------------

describe('AmrapInput', () => {
  describe('display values', () => {
    it('should render em-dash when value is undefined', () => {
      render(<AmrapInput value={undefined} onChange={vi.fn()} />);

      const display = screen.getByLabelText('Reps AMRAP', { selector: 'span' });

      expect(display.textContent).toBe('\u2014');
    });

    it('should render 0 when value is 0', () => {
      render(<AmrapInput value={0} onChange={vi.fn()} />);

      const display = screen.getByLabelText('Reps AMRAP', { selector: 'span' });

      expect(display.textContent).toBe('0');
    });

    it('should render 5 when value is 5', () => {
      render(<AmrapInput value={5} onChange={vi.fn()} />);

      const display = screen.getByLabelText('Reps AMRAP', { selector: 'span' });

      expect(display.textContent).toBe('5');
    });
  });

  describe('button state', () => {
    it('should disable decrement button when value is undefined', () => {
      render(<AmrapInput value={undefined} onChange={vi.fn()} />);

      const decrementBtn = screen.getByLabelText('Disminuir reps');

      expect(decrementBtn).toBeDisabled();
    });
  });

  describe('interaction', () => {
    it('should call onChange(1) when + button is clicked and value is undefined', () => {
      const onChange = vi.fn();
      render(<AmrapInput value={undefined} onChange={onChange} />);

      const incrementBtn = screen.getByLabelText('Aumentar reps');
      fireEvent.click(incrementBtn);

      expect(onChange).toHaveBeenCalledWith(1);
    });
  });

  describe('inline 1RM estimate', () => {
    it('should show "1RM est." when result=success and weight provided and value > 0', () => {
      render(<AmrapInput value={5} onChange={vi.fn()} result="success" weight={60} />);

      const estimateText = screen.getByText(/1RM est\./);

      expect(estimateText).toBeDefined();
    });

    it('should NOT show 1RM estimate when result=fail', () => {
      render(<AmrapInput value={5} onChange={vi.fn()} result="fail" weight={60} />);

      const estimateTexts = screen.queryByText(/1RM est\./);

      expect(estimateTexts).toBeNull();
    });

    it('should NOT show 1RM estimate when value is undefined', () => {
      render(<AmrapInput value={undefined} onChange={vi.fn()} result="success" weight={60} />);

      const estimateTexts = screen.queryByText(/1RM est\./);

      expect(estimateTexts).toBeNull();
    });
  });
});
