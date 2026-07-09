import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import { SetupForm } from './setup-form';

const definition = {
  id: 'gzclp',
  name: 'GZCLP',
  description: '',
  author: '',
  version: 1,
  category: 'strength',
  source: 'preset',
  days: [
    {
      name: 'Day 1',
      slots: [{ id: 's1', tier: 'T1', exerciseKey: 'squat', scheme: '5x3', progression: 'linear' }],
    },
  ],
  cycleLength: 1,
  totalWorkouts: 12,
  configFields: [{ key: 'squat', label: 'Sentadilla', type: 'weight', min: 2.5, step: 2.5 }],
  weightIncrements: { squat: 2.5 },
} as unknown as ProgramDefinition;

describe('SetupForm validation', () => {
  it('shows min-weight alert after entering a below-min value and blurring', async () => {
    render(
      createElement(SetupForm, {
        definition,
        onGenerate: vi.fn().mockResolvedValue(undefined),
      })
    );

    const input = document.getElementById('weight-squat') as HTMLInputElement;
    expect(input).not.toBeNull();

    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.blur(input);

    const alert = await screen.findByRole('alert', {}, { timeout: 3000 });
    expect(alert.textContent).toContain('2.5');
  });

  it('shows errors on submit with a below-min value', async () => {
    const onGenerate = vi.fn().mockResolvedValue(undefined);
    render(createElement(SetupForm, { definition, onGenerate }));

    const input = document.getElementById('weight-squat') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: /generar/i }));

    const alerts = await screen.findAllByRole('alert', {}, { timeout: 3000 });
    expect(alerts.length).toBeGreaterThan(0);
    expect(onGenerate).not.toHaveBeenCalled();
  });
});
