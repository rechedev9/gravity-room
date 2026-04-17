import { describe, it, expect, mock, beforeAll } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';

// Polyfill dialog methods for happy-dom if missing
beforeAll(() => {
  if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
  }
});
import { Toolbar } from './toolbar';

// ---------------------------------------------------------------------------
// Toolbar — behavioral integration tests
// ---------------------------------------------------------------------------

function buildToolbarProps(overrides?: Partial<Parameters<typeof Toolbar>[0]>) {
  return {
    completedCount: 10,
    totalWorkouts: 90,
    undoCount: 0,
    isFinishing: false,
    onUndo: mock(),
    onFinish: mock(() => Promise.resolve()),
    onReset: mock(),
    onExportCsv: mock(),
    ...overrides,
  };
}

function openOverflowMenu(): void {
  fireEvent.click(screen.getByLabelText('Más acciones'));
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

      const undoBtn = screen.getByText('Deshacer');
      expect(undoBtn).toBeDisabled();
    });

    it('should be enabled when undoCount is positive', () => {
      render(<Toolbar {...buildToolbarProps({ undoCount: 3 })} />);

      const undoBtn = screen.getByText('Deshacer');
      expect(undoBtn).not.toBeDisabled();
    });

    it('should show undo count when positive', () => {
      render(<Toolbar {...buildToolbarProps({ undoCount: 3 })} />);

      expect(screen.getByText('3x')).toBeInTheDocument();
    });

    it('should call onUndo when clicked', () => {
      const onUndo = mock();
      render(<Toolbar {...buildToolbarProps({ undoCount: 1, onUndo })} />);

      fireEvent.click(screen.getByText('Deshacer'));

      expect(onUndo).toHaveBeenCalledTimes(1);
    });
  });

  describe('action buttons', () => {
    it('should render "⋮" button with ghost variant class (REQ-SPACE-002)', () => {
      render(<Toolbar {...buildToolbarProps()} />);

      const btn = screen.getByLabelText('Más acciones');

      expect(btn.className).toContain('bg-card');
    });

    it('should render "Deshacer" WITHOUT ghost variant class (REQ-SPACE-002)', () => {
      render(<Toolbar {...buildToolbarProps({ undoCount: 1 })} />);

      const btn = screen.getByText('Deshacer');

      // Ghost variant uses bg-card; default variant does NOT
      // (default uses bg-btn which is different)
      // The ghost class string contains 'bg-card' but the default button
      // uses 'bg-btn'. Both contain 'bg-' so we check the ghost-specific text.
      expect(btn.className).not.toContain('text-muted');
    });
  });

  describe('reset flow', () => {
    it('should show confirmation dialog when Reiniciar Todo is clicked', () => {
      render(<Toolbar {...buildToolbarProps()} />);

      openOverflowMenu();
      fireEvent.click(screen.getByRole('menuitem', { name: 'Reiniciar Todo' }));

      const dialog = screen.getByRole('dialog');
      expect(dialog.hasAttribute('open')).toBe(true);
      expect(screen.getByText('Reiniciar Todo el Progreso')).toBeInTheDocument();
    });

    it('should call onReset when reset is confirmed', () => {
      const onReset = mock();
      render(<Toolbar {...buildToolbarProps({ onReset })} />);

      openOverflowMenu();
      fireEvent.click(screen.getByRole('menuitem', { name: 'Reiniciar Todo' }));
      const confirmBtns = screen.getAllByText('Reiniciar Todo');
      fireEvent.click(confirmBtns[confirmBtns.length - 1]);

      expect(onReset).toHaveBeenCalledTimes(1);
    });

    it('should dismiss dialog when cancel is clicked', () => {
      render(<Toolbar {...buildToolbarProps()} />);

      openOverflowMenu();
      fireEvent.click(screen.getByRole('menuitem', { name: 'Reiniciar Todo' }));

      // The reset dialog is the one with [open]; find Cancel within it
      const openDialog = screen.getByRole('dialog');
      const cancelBtn = openDialog.querySelector('button');
      expect(cancelBtn).not.toBeNull();
      fireEvent.click(cancelBtn!);

      const dialogs = screen.getAllByRole('dialog', { hidden: true });
      const allClosed = dialogs.every((d) => !d.hasAttribute('open'));
      expect(allClosed).toBe(true);
    });
  });
});
