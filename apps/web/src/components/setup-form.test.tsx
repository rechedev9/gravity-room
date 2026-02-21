import { describe, it, expect, mock } from 'bun:test';
import { render, screen, fireEvent } from '@testing-library/react';
import { SetupForm } from './setup-form';
import { DEFAULT_WEIGHTS } from '../../test/helpers/fixtures';

// ---------------------------------------------------------------------------
// SetupForm — behavioral integration tests
// ---------------------------------------------------------------------------
describe('SetupForm', () => {
  describe('initial render (new program)', () => {
    it('should show all 6 exercise fields with default values', () => {
      const onGenerate = mock(() => Promise.resolve());
      render(<SetupForm onGenerate={onGenerate} />);

      expect(screen.getByLabelText('Sentadilla (T1)')).toHaveValue(60);
      expect(screen.getByLabelText('Press Banca (T1)')).toHaveValue(40);
      expect(screen.getByLabelText('Peso Muerto (T1)')).toHaveValue(60);
      expect(screen.getByLabelText('Press Militar (T1)')).toHaveValue(30);
      expect(screen.getByLabelText('Jalón al Pecho (T3)')).toHaveValue(30);
      expect(screen.getByLabelText('Remo con Mancuernas (T3)')).toHaveValue(12.5);
    });

    it('should show "Generar Programa" button', () => {
      render(<SetupForm onGenerate={mock(() => Promise.resolve())} />);

      expect(screen.getByText('Generar Programa')).toBeInTheDocument();
    });

    it('should not show Cancelar button in new program mode', () => {
      render(<SetupForm onGenerate={mock(() => Promise.resolve())} />);

      expect(screen.queryByText('Cancelar')).not.toBeInTheDocument();
    });
  });

  describe('submit', () => {
    it('should call onGenerate with parsed weights on submit', () => {
      const onGenerate = mock(() => Promise.resolve());
      render(<SetupForm onGenerate={onGenerate} />);

      fireEvent.click(screen.getByText('Generar Programa'));

      expect(onGenerate).toHaveBeenCalledTimes(1);
      expect(onGenerate).toHaveBeenCalledWith(
        expect.objectContaining({ squat: 60, bench: 40, deadlift: 60, ohp: 30 })
      );
    });
  });

  describe('validation', () => {
    it('should show error when a field is empty', () => {
      render(<SetupForm onGenerate={mock(() => Promise.resolve())} />);

      const squatInput = screen.getByLabelText('Sentadilla (T1)');
      fireEvent.change(squatInput, { target: { value: '' } });
      fireEvent.blur(squatInput);

      expect(screen.getByText('Requerido')).toBeInTheDocument();
    });

    it('should show error when weight is below minimum', () => {
      render(<SetupForm onGenerate={mock(() => Promise.resolve())} />);

      const squatInput = screen.getByLabelText('Sentadilla (T1)');
      fireEvent.change(squatInput, { target: { value: '1' } });
      fireEvent.blur(squatInput);

      // The error is shown in a role="alert" element with id="squat-error"
      const errorEl = document.getElementById('squat-error');
      expect(errorEl).not.toBeNull();
      expect(errorEl!.textContent).toContain('Mín 2.5 kg');
    });

    it('should show error when weight exceeds maximum', () => {
      render(<SetupForm onGenerate={mock(() => Promise.resolve())} />);

      const squatInput = screen.getByLabelText('Sentadilla (T1)');
      fireEvent.change(squatInput, { target: { value: '501' } });
      fireEvent.blur(squatInput);

      expect(screen.getByText('Máx 500 kg')).toBeInTheDocument();
    });

    it('should not call onGenerate when validation fails', () => {
      const onGenerate = mock(() => Promise.resolve());
      render(<SetupForm onGenerate={onGenerate} />);

      const squatInput = screen.getByLabelText('Sentadilla (T1)');
      fireEvent.change(squatInput, { target: { value: '' } });
      fireEvent.click(screen.getByText('Generar Programa'));

      expect(onGenerate).not.toHaveBeenCalled();
    });

    it('should show summary error message when submit fails validation', () => {
      render(<SetupForm onGenerate={mock(() => Promise.resolve())} />);

      const squatInput = screen.getByLabelText('Sentadilla (T1)');
      fireEvent.change(squatInput, { target: { value: '' } });
      fireEvent.click(screen.getByText('Generar Programa'));

      expect(screen.getByText('Por favor corrige lo siguiente:')).toBeInTheDocument();
    });
  });

  describe('+/- weight adjustment', () => {
    it('should increase weight when + button is clicked', () => {
      render(<SetupForm onGenerate={mock(() => Promise.resolve())} />);

      const increaseBtn = screen.getByLabelText('Aumentar Sentadilla (T1)');
      fireEvent.click(increaseBtn);

      expect(screen.getByLabelText('Sentadilla (T1)')).toHaveValue(60.5);
    });

    it('should decrease weight when - button is clicked', () => {
      render(<SetupForm onGenerate={mock(() => Promise.resolve())} />);

      const decreaseBtn = screen.getByLabelText('Disminuir Sentadilla (T1)');
      fireEvent.click(decreaseBtn);

      expect(screen.getByLabelText('Sentadilla (T1)')).toHaveValue(59.5);
    });
  });

  describe('edit mode', () => {
    it('should show collapsed summary with current weights', () => {
      render(
        <SetupForm
          initialWeights={DEFAULT_WEIGHTS}
          onGenerate={mock(() => Promise.resolve())}
          onUpdateWeights={mock(() => Promise.resolve())}
        />
      );

      expect(screen.getByText('Pesos Iniciales')).toBeInTheDocument();
      expect(screen.getByText('Editar Pesos')).toBeInTheDocument();
    });

    it('should expand form when Editar Pesos is clicked', () => {
      render(
        <SetupForm
          initialWeights={DEFAULT_WEIGHTS}
          onGenerate={mock(() => Promise.resolve())}
          onUpdateWeights={mock(() => Promise.resolve())}
        />
      );

      fireEvent.click(screen.getByText('Editar Pesos'));

      expect(screen.getByText('Editar Pesos Iniciales (kg)')).toBeInTheDocument();
      expect(screen.getByText('Actualizar Pesos')).toBeInTheDocument();
      expect(screen.getByText('Cancelar')).toBeInTheDocument();
    });

    it('should show confirmation dialog before updating weights', () => {
      render(
        <SetupForm
          initialWeights={DEFAULT_WEIGHTS}
          onGenerate={mock(() => Promise.resolve())}
          onUpdateWeights={mock(() => Promise.resolve())}
        />
      );

      fireEvent.click(screen.getByText('Editar Pesos'));
      fireEvent.click(screen.getByText('Actualizar Pesos'));

      expect(screen.getByText('Actualizar Pesos Iniciales')).toBeInTheDocument();
    });

    it('should collapse back when Cancelar is clicked', () => {
      render(
        <SetupForm
          initialWeights={DEFAULT_WEIGHTS}
          onGenerate={mock(() => Promise.resolve())}
          onUpdateWeights={mock(() => Promise.resolve())}
        />
      );

      fireEvent.click(screen.getByText('Editar Pesos'));
      fireEvent.click(screen.getByText('Cancelar'));

      expect(screen.getByText('Editar Pesos')).toBeInTheDocument();
      expect(screen.queryByText('Actualizar Pesos')).not.toBeInTheDocument();
    });
  });
});
