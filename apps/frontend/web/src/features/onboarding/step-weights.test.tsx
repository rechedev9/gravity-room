import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import { StepWeights } from './step-weights';

type WeightField = ProgramDefinition['configFields'][number] & { type: 'weight' };

const FIELDS: readonly WeightField[] = [
  { key: 'squat', label: 'Sentadilla', type: 'weight', min: 20, step: 2.5 },
  { key: 'bench', label: 'Press de banca', type: 'weight', min: 20, step: 2.5 },
];

function renderStep(values: Record<string, number | undefined> = {}) {
  const onChange = vi.fn();
  const onContinue = vi.fn();
  const onBack = vi.fn();
  render(
    <StepWeights
      fields={FIELDS}
      values={values}
      onChange={onChange}
      onBack={onBack}
      onContinue={onContinue}
    />
  );
  return { onChange, onContinue, onBack };
}

describe('StepWeights', () => {
  afterEach(cleanup);

  it('asks for one lift at a time instead of a grid of inputs', () => {
    renderStep();
    expect(screen.getByRole('heading', { name: 'Sentadilla' })).toBeInTheDocument();
    expect(screen.getByTestId('start-step-weights').textContent).toContain('Levantamiento 1 de 2');
  });

  it('cannot advance until the current lift has a load', () => {
    renderStep();
    expect(screen.getByTestId('start-weights-next')).toBeDisabled();
  });

  it.each([
    { label: 'Subir carga de Sentadilla', from: 100, expected: 102.5 },
    { label: 'Bajar carga de Sentadilla', from: 100, expected: 97.5 },
  ])('$label steps by the field step', ({ label, from, expected }) => {
    const { onChange } = renderStep({ squat: from });
    fireEvent.click(screen.getByRole('button', { name: label }));
    expect(onChange).toHaveBeenCalledWith('squat', expected);
  });

  it('clamps the stepper to the field minimum', () => {
    const { onChange } = renderStep({ squat: 20 });
    fireEvent.click(screen.getByRole('button', { name: 'Bajar carga de Sentadilla' }));
    expect(onChange).toHaveBeenCalledWith('squat', 20);
  });

  it('offers an explicit "I do not know" that starts from the bar', () => {
    const { onChange } = renderStep();
    fireEvent.click(screen.getByTestId('start-weights-unknown'));
    expect(onChange).toHaveBeenCalledWith('squat', 20);
  });

  it('shows how the current number loads onto the bar', () => {
    renderStep({ squat: 100 });
    const breakdown = screen.getByTestId('plate-breakdown');
    expect(breakdown.textContent).toContain('1 × 25');
    expect(breakdown.textContent).toContain('1 × 15');
  });

  it('converts a known 1RM into the load the program asks for', () => {
    const { onChange } = renderStep({ squat: 100 });

    fireEvent.click(screen.getByTestId('start-open-calculator'));
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '180' } });
    expect(screen.getByTestId('one-rm-estimate')).toHaveTextContent('155');

    fireEvent.click(screen.getByTestId('one-rm-use'));
    expect(onChange).toHaveBeenCalledWith('squat', 155);
  });

  it('only finishes the step after the last lift', () => {
    const { onContinue } = renderStep({ squat: 100, bench: 60 });

    fireEvent.click(screen.getByTestId('start-weights-next'));
    expect(onContinue).not.toHaveBeenCalled();
    expect(screen.getByTestId('start-step-weights').textContent).toContain('Levantamiento 2 de 2');

    fireEvent.click(screen.getByTestId('start-weights-next'));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
