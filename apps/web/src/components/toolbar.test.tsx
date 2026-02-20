import { describe, it, expect, mock } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toolbar } from './toolbar';

// ---------------------------------------------------------------------------
// Toolbar — behavioral integration tests
// ---------------------------------------------------------------------------

function buildToolbarProps(overrides?: Partial<Parameters<typeof Toolbar>[0]>) {
  return {
    completedCount: 10,
    totalWorkouts: 90,
    undoCount: 0,
    onUndo: mock(),
    onJumpToCurrent: mock(),
    onReset: mock(),
    ...overrides,
  };
}

function openOverflowMenu(): void {
  fireEvent.click(screen.getByLabelText('More actions'));
}

describe('Toolbar', () => {
  describe('progress display', () => {
    it('should show completed count and percentage', () => {
      render(<Toolbar {...buildToolbarProps({ completedCount: 45, totalWorkouts: 90 })} />);

      // Desktop progress text contains "45 / 90 (50%)" (with spaces)
      expect(screen.getAllByText(/45/).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/50%/).length).toBeGreaterThan(0);
    });
  });

  describe('undo button', () => {
    it('should be disabled when undoCount is 0', () => {
      render(<Toolbar {...buildToolbarProps({ undoCount: 0 })} />);

      const undoBtn = screen.getByText('Undo');
      expect(undoBtn).toBeDisabled();
    });

    it('should be enabled when undoCount is positive', () => {
      render(<Toolbar {...buildToolbarProps({ undoCount: 3 })} />);

      const undoBtn = screen.getByText('Undo');
      expect(undoBtn).not.toBeDisabled();
    });

    it('should show undo count when positive', () => {
      render(<Toolbar {...buildToolbarProps({ undoCount: 3 })} />);

      expect(screen.getByText('3x')).toBeInTheDocument();
    });

    it('should call onUndo when clicked', () => {
      const onUndo = mock();
      render(<Toolbar {...buildToolbarProps({ undoCount: 1, onUndo })} />);

      fireEvent.click(screen.getByText('Undo'));

      expect(onUndo).toHaveBeenCalledTimes(1);
    });
  });

  describe('action buttons', () => {
    it('should call onJumpToCurrent when Go to current is clicked', () => {
      const onJumpToCurrent = mock();
      render(<Toolbar {...buildToolbarProps({ onJumpToCurrent })} />);

      fireEvent.click(screen.getByText('Go to current'));

      expect(onJumpToCurrent).toHaveBeenCalledTimes(1);
    });
  });

  describe('reset flow', () => {
    it('should show confirmation dialog when Reset All is clicked', () => {
      render(<Toolbar {...buildToolbarProps()} />);

      openOverflowMenu();
      fireEvent.click(screen.getByText('Reset All'));

      expect(screen.getByText('Reset All Progress')).toBeInTheDocument();
      expect(
        screen.getByText('Are you sure you want to reset ALL progress? This cannot be undone.')
      ).toBeInTheDocument();
    });

    it('should call onReset when reset is confirmed', () => {
      const onReset = mock();
      render(<Toolbar {...buildToolbarProps({ onReset })} />);

      openOverflowMenu();
      fireEvent.click(screen.getByText('Reset All'));
      // The confirm dialog has a "Reset All" confirm button
      const confirmBtns = screen.getAllByText('Reset All');
      fireEvent.click(confirmBtns[confirmBtns.length - 1]);

      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('should dismiss dialog when cancel is clicked', () => {
      render(<Toolbar {...buildToolbarProps()} />);

      openOverflowMenu();
      fireEvent.click(screen.getByText('Reset All'));
      fireEvent.click(screen.getByText('Cancel'));

      expect(screen.queryByText('Reset All Progress')).not.toBeInTheDocument();
    });
  });
});
