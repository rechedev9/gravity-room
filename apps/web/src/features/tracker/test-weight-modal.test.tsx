import { describe, it, expect, mock, beforeAll } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { TestWeightModal } from './test-weight-modal';

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

// ---------------------------------------------------------------------------
// TestWeightModal — unit tests
// ---------------------------------------------------------------------------

describe('TestWeightModal', () => {
  const baseProps = {
    isOpen: true,
    liftName: 'Sentadilla',
    hasPropagationTarget: true,
    defaultWeight: 100,
    onConfirm: mock(),
    onCancel: mock(),
  };

  describe('rendering', () => {
    it('should render dialog when isOpen is true', () => {
      render(<TestWeightModal {...baseProps} />);

      const dialog = screen.getByRole('dialog');

      expect(dialog).toBeInTheDocument();
    });

    it('should not have open attribute when isOpen is false', () => {
      render(<TestWeightModal {...baseProps} isOpen={false} />);

      const dialog = screen.getByRole('dialog', { hidden: true });

      expect(dialog.hasAttribute('open')).toBe(false);
    });
  });

  describe('weight input', () => {
    it('should pre-fill input with defaultWeight', () => {
      render(<TestWeightModal {...baseProps} defaultWeight={120} />);

      const input = screen.getByRole('spinbutton') as HTMLInputElement;

      expect(input.value).toBe('120');
    });

    it('should allow editing the weight value', () => {
      render(<TestWeightModal {...baseProps} />);

      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      fireEvent.change(input, { target: { value: '140' } });

      expect(input.value).toBe('140');
    });
  });

  describe('confirm', () => {
    it('should call onConfirm with the entered weight as a number', () => {
      const onConfirm = mock();
      render(<TestWeightModal {...baseProps} onConfirm={onConfirm} defaultWeight={100} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '135' } });
      fireEvent.click(screen.getByText('Confirmar'));

      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith(135);
    });

    it('should disable Confirmar button when input is empty', () => {
      render(<TestWeightModal {...baseProps} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '' } });

      const confirmBtn = screen.getByText('Confirmar');

      expect(confirmBtn).toBeDisabled();
    });

    it('should disable Confirmar button when input value is below minimum (20)', () => {
      render(<TestWeightModal {...baseProps} />);

      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '0' } });

      const confirmBtn = screen.getByText('Confirmar');

      expect(confirmBtn).toBeDisabled();
    });
  });

  describe('cancel', () => {
    it('should call onCancel when Cancelar button is clicked', () => {
      const onCancel = mock();
      render(<TestWeightModal {...baseProps} onCancel={onCancel} />);

      fireEvent.click(screen.getByText('Cancelar'));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('should not call onConfirm when Cancelar is clicked', () => {
      const onConfirm = mock();
      const onCancel = mock();
      render(<TestWeightModal {...baseProps} onConfirm={onConfirm} onCancel={onCancel} />);

      fireEvent.click(screen.getByText('Cancelar'));

      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('blocking behavior', () => {
    it('should prevent dismissal on native cancel event (Escape key)', () => {
      const onConfirm = mock();
      const onCancel = mock();
      render(<TestWeightModal {...baseProps} onConfirm={onConfirm} onCancel={onCancel} />);

      const dialog = screen.getByRole('dialog');
      const cancelEvent = new Event('cancel', { bubbles: false, cancelable: true });
      dialog.dispatchEvent(cancelEvent);

      expect(cancelEvent.defaultPrevented).toBe(true);
      expect(onConfirm).not.toHaveBeenCalled();
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('should not render a close or dismiss button', () => {
      render(<TestWeightModal {...baseProps} />);

      // Only two buttons exist: Cancelar and Confirmar
      const buttons = screen.getAllByRole('button');
      const buttonTexts = buttons.map((b) => b.textContent);

      expect(buttonTexts).toContain('Cancelar');
      expect(buttonTexts).toContain('Confirmar');
      expect(buttons.length).toBe(2);
    });
  });

  describe('propagation copy', () => {
    it('should show next-block TM copy when hasPropagationTarget is true', () => {
      render(<TestWeightModal {...baseProps} hasPropagationTarget={true} />);

      expect(screen.getByText(/Training Max del siguiente bloque/i)).toBeInTheDocument();
    });

    it('should not reference next-block TM when hasPropagationTarget is false', () => {
      render(<TestWeightModal {...baseProps} hasPropagationTarget={false} />);

      expect(screen.queryByText(/Training Max del siguiente bloque/i)).not.toBeInTheDocument();
    });
  });
});
