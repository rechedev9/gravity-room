import { describe, it, expect, mock } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultCell } from './result-cell';

// ---------------------------------------------------------------------------
// ResultCell — isTestSlot rendering tests
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

      const btn = screen.getByRole('button', { name: /registrar maximo/i });

      expect(btn).toBeInTheDocument();
    });

    it('should render a single "Registrar Maximo" button in card variant', () => {
      render(<ResultCell {...baseProps} variant="card" isTestSlot={true} />);

      const btn = screen.getByRole('button', { name: /registrar maximo/i });

      expect(btn).toBeInTheDocument();
    });

    it('should not render Pass or Fail buttons for a pending test slot', () => {
      render(<ResultCell {...baseProps} variant="table" isTestSlot={true} />);

      expect(screen.queryByRole('button', { name: /exito/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /fallo/i })).not.toBeInTheDocument();
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

      fireEvent.click(screen.getByRole('button', { name: /registrar maximo/i }));

      expect(onMark).toHaveBeenCalledTimes(1);
      expect(onMark).toHaveBeenCalledWith(5, 'test', 'success');
    });
  });

  describe('pending non-test slot', () => {
    it('should render Pass and Fail buttons when isTestSlot is not set', () => {
      render(<ResultCell {...baseProps} variant="table" />);

      expect(screen.getByRole('button', { name: /éxito/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /fallo/i })).toBeInTheDocument();
    });

    it('should not render "Registrar Maximo" button for a non-test slot', () => {
      render(<ResultCell {...baseProps} variant="table" />);

      expect(screen.queryByRole('button', { name: /registrar maximo/i })).not.toBeInTheDocument();
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

      const undoBtn = screen.getByRole('button', { name: /deshacer/i });

      expect(undoBtn).toBeInTheDocument();
      fireEvent.click(undoBtn);
      expect(onUndo).toHaveBeenCalledTimes(1);
    });
  });
});
