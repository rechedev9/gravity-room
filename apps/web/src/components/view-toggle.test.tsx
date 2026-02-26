import { describe, it, expect, mock } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewToggle } from './view-toggle';

// ---------------------------------------------------------------------------
// ViewToggle — unit tests (REQ-CVT-003)
// ---------------------------------------------------------------------------

describe('ViewToggle', () => {
  describe('aria-label', () => {
    it('should mention target mode "tabla" when viewMode is card', () => {
      render(<ViewToggle viewMode="card" onToggle={mock()} />);

      const button = screen.getByRole('button');

      expect(button.getAttribute('aria-label')).toContain('tabla');
    });

    it('should mention target mode "tarjetas" when viewMode is table', () => {
      render(<ViewToggle viewMode="table" onToggle={mock()} />);

      const button = screen.getByRole('button');

      expect(button.getAttribute('aria-label')).toContain('tarjetas');
    });
  });

  describe('interaction', () => {
    it('should call onToggle when clicked', () => {
      const onToggle = mock();
      render(<ViewToggle viewMode="card" onToggle={onToggle} />);

      fireEvent.click(screen.getByRole('button'));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('touch target', () => {
    it('should have min-h-[44px] class for accessible touch target', () => {
      render(<ViewToggle viewMode="card" onToggle={mock()} />);

      const button = screen.getByRole('button');

      expect(button.className).toContain('min-h-[44px]');
    });
  });
});
