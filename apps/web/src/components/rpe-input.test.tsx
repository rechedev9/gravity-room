/**
 * rpe-input.test.tsx — accessibility attribute tests for RpeInput.
 * Tests aria-label and aria-pressed on each RPE toggle button.
 * Tests label prop display (REQ-UI-002).
 * Tests RPE 5 addition (REQ-RPE-001).
 */
import { describe, it, expect, mock } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { RpeInput } from './rpe-input';

const RPE_VALUES = [5, 6, 7, 8, 9, 10] as const;

// ---------------------------------------------------------------------------
// aria attributes
// ---------------------------------------------------------------------------

describe('RpeInput', () => {
  describe('aria attributes', () => {
    it('each button has aria-label starting with "RPE {n}:" for values 5-10', () => {
      render(<RpeInput value={undefined} onChange={mock()} label="T1" />);

      for (const rpe of RPE_VALUES) {
        const button = screen.getByRole('button', { name: new RegExp(`^RPE ${rpe}:`) });
        expect(button).toBeDefined();
      }
    });

    it('selected button has aria-pressed="true"', () => {
      render(<RpeInput value={8} onChange={mock()} label="T1" />);

      const activeButton = screen.getByRole('button', { name: /^RPE 8:/ });
      expect(activeButton.getAttribute('aria-pressed')).toBe('true');
    });

    it('unselected buttons have aria-pressed="false"', () => {
      render(<RpeInput value={8} onChange={mock()} label="T1" />);

      for (const rpe of RPE_VALUES) {
        if (rpe === 8) continue;
        const button = screen.getByRole('button', { name: new RegExp(`^RPE ${rpe}:`) });
        expect(button.getAttribute('aria-pressed')).toBe('false');
      }
    });

    it('all buttons have aria-pressed="false" when no value is selected', () => {
      render(<RpeInput value={undefined} onChange={mock()} label="T1" />);

      for (const rpe of RPE_VALUES) {
        const button = screen.getByRole('button', { name: new RegExp(`^RPE ${rpe}:`) });
        expect(button.getAttribute('aria-pressed')).toBe('false');
      }
    });
  });

  describe('label prop display (REQ-UI-002)', () => {
    it('renders MAIN RPE when label is MAIN', () => {
      const { container } = render(<RpeInput value={undefined} onChange={mock()} label="MAIN" />);

      const labelEl = container.querySelector('.text-xs');
      expect(labelEl?.textContent).toBe('MAIN RPE');
    });

    it('renders T1 RPE when label is T1 (backwards compat)', () => {
      const { container } = render(<RpeInput value={undefined} onChange={mock()} label="T1" />);

      const labelEl = container.querySelector('.text-xs');
      expect(labelEl?.textContent).toBe('T1 RPE');
    });
  });

  describe('RPE 5 support (REQ-RPE-001)', () => {
    it('renders exactly 6 buttons with labels 5-10', () => {
      render(<RpeInput value={undefined} onChange={mock()} label="T1" />);

      const buttons = screen.getAllByRole('button');

      expect(buttons).toHaveLength(6);
      expect(buttons[0].textContent).toBe('5');
      expect(buttons[5].textContent).toBe('10');
    });

    it('calls onChange(5) when RPE 5 button is tapped', () => {
      const onChange = mock();
      render(<RpeInput value={undefined} onChange={onChange} label="T1" />);

      const rpe5Button = screen.getByRole('button', { name: /^RPE 5:/ });
      fireEvent.click(rpe5Button);

      expect(onChange).toHaveBeenCalledWith(5);
    });

    it('RPE 5 button has title "Muy fácil — 5+ reps en reserva"', () => {
      render(<RpeInput value={undefined} onChange={mock()} label="T1" />);

      const rpe5Button = screen.getByRole('button', { name: /^RPE 5:/ });

      expect(rpe5Button.getAttribute('title')).toBe('Muy fácil — 5+ reps en reserva');
    });

    it('RPE 5 button with value={5} renders with active style', () => {
      render(<RpeInput value={5} onChange={mock()} label="T1" />);

      const rpe5Button = screen.getByRole('button', { name: /^RPE 5:/ });

      expect(rpe5Button.className).toContain('bg-[var(--fill-progress)]');
      expect(rpe5Button.getAttribute('aria-pressed')).toBe('true');
    });
  });
});
