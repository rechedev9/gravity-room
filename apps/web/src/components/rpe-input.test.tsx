/**
 * rpe-input.test.tsx — accessibility attribute tests for RpeInput.
 * Tests aria-label and aria-pressed on each RPE toggle button.
 */
import { describe, it, expect, mock } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { RpeInput } from './rpe-input';

const RPE_VALUES = [6, 7, 8, 9, 10] as const;

// ---------------------------------------------------------------------------
// aria attributes
// ---------------------------------------------------------------------------

describe('RpeInput', () => {
  describe('aria attributes', () => {
    it('each button has aria-label in the format "RPE {n}" for values 6-10', () => {
      render(<RpeInput value={undefined} onChange={mock()} tier="t1" />);

      for (const rpe of RPE_VALUES) {
        const button = screen.getByRole('button', { name: `RPE ${rpe}` });
        expect(button).toBeDefined();
      }
    });

    it('selected button has aria-pressed="true"', () => {
      render(<RpeInput value={8} onChange={mock()} tier="t1" />);

      const activeButton = screen.getByRole('button', { name: 'RPE 8' });
      expect(activeButton.getAttribute('aria-pressed')).toBe('true');
    });

    it('unselected buttons have aria-pressed="false"', () => {
      render(<RpeInput value={8} onChange={mock()} tier="t1" />);

      for (const rpe of RPE_VALUES) {
        if (rpe === 8) continue;
        const button = screen.getByRole('button', { name: `RPE ${rpe}` });
        expect(button.getAttribute('aria-pressed')).toBe('false');
      }
    });

    it('all buttons have aria-pressed="false" when no value is selected', () => {
      render(<RpeInput value={undefined} onChange={mock()} tier="t1" />);

      for (const rpe of RPE_VALUES) {
        const button = screen.getByRole('button', { name: `RPE ${rpe}` });
        expect(button.getAttribute('aria-pressed')).toBe('false');
      }
    });
  });
});
