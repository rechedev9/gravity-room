import { describe, it, expect, mock } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultCell } from './result-cell';

// ---------------------------------------------------------------------------
// ResultCell — isTestSlot rendering tests
// Tests use data-testid selectors to avoid i18n language-race conditions that
// occur when parallel test workers call changeLanguage() concurrently.
// ---------------------------------------------------------------------------

describe('ResultCell', () => {
  const baseProps = {
    index: 0,
    tier: 'main',
    onMark: mock(),
    onUndo: mock(),
  };

  describe('pending test slot (isTestSlot=true)', () => {
    it('should render a single "Registrar Maximo" button in table variant', () => {
      render(<ResultCell {...baseProps} variant="table" isTestSlot={true} />);

      const btn = screen.getByTestId('result-cell-register-max');

      expect(btn).toBeInTheDocument();
    });

    it('should render a single "Registrar Maximo" button in card variant', () => {
      render(<ResultCell {...baseProps} variant="card" isTestSlot={true} />);

      const btn = screen.getByTestId('result-cell-register-max');

      expect(btn).toBeInTheDocument();
    });

    it('should not render Pass or Fail buttons for a pending test slot', () => {
      render(<ResultCell {...baseProps} variant="table" isTestSlot={true} />);

      expect(screen.queryByTestId('result-cell-mark-success')).not.toBeInTheDocument();
      expect(screen.queryByTestId('result-cell-mark-fail')).not.toBeInTheDocument();
    });

    it('should call onMark with (index, tier, "success") when clicked', () => {
      const onMark = mock();
      render(
        <ResultCell
          {...baseProps}
          index={5}
          tier="test"
          variant="table"
          isTestSlot={true}
          onMark={onMark}
        />
      );

      fireEvent.click(screen.getByTestId('result-cell-register-max'));

      expect(onMark).toHaveBeenCalledTimes(1);
      expect(onMark).toHaveBeenCalledWith(5, 'test', 'success');
    });
  });

  describe('pending non-test slot', () => {
    it('should render Pass and Fail buttons when isTestSlot is not set', () => {
      render(<ResultCell {...baseProps} variant="table" />);

      expect(screen.getByTestId('result-cell-mark-success')).toBeInTheDocument();
      expect(screen.getByTestId('result-cell-mark-fail')).toBeInTheDocument();
    });

    it('should not render "Registrar Maximo" button for a non-test slot', () => {
      render(<ResultCell {...baseProps} variant="table" />);

      expect(screen.queryByTestId('result-cell-register-max')).not.toBeInTheDocument();
    });
  });

  describe('completed test slot', () => {
    it('should render undo badge with success styling when result is success', () => {
      const onUndo = mock();
      render(
        <ResultCell
          {...baseProps}
          variant="table"
          isTestSlot={true}
          result="success"
          onUndo={onUndo}
        />
      );

      const undoBtn = screen.getByTestId('result-cell-undo');

      expect(undoBtn).toBeInTheDocument();
      fireEvent.click(undoBtn);
      expect(onUndo).toHaveBeenCalledTimes(1);
    });
  });
});
