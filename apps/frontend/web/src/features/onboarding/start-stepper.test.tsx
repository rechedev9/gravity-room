import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { StartStepper, START_STEPS, type StartStep } from './start-stepper';

function statesFor(current: StartStep): readonly string[] {
  render(<StartStepper current={current} />);
  return START_STEPS.map(
    (step) =>
      screen
        .getByTestId('start-stepper')
        .querySelector(`[data-step="${step}"]`)
        ?.getAttribute('data-state') ?? ''
  );
}

describe('StartStepper', () => {
  afterEach(cleanup);

  it.each([
    { current: 'program' as StartStep, expected: ['current', 'todo', 'todo'] },
    { current: 'weights' as StartStep, expected: ['done', 'current', 'todo'] },
    { current: 'first-day' as StartStep, expected: ['done', 'done', 'current'] },
  ])('marks the steps for $current', ({ current, expected }) => {
    expect(statesFor(current)).toEqual(expected);
  });

  it('appends the trailing note of a step once there is one', () => {
    render(<StartStepper current="weights" notes={{ program: 'GZCLP' }} />);
    const step = screen.getByTestId('start-stepper').querySelector('[data-step="program"]');
    expect(step?.textContent).toContain('01');
    expect(step?.textContent).toContain('GZCLP');
  });

  it('omits the separator when a step has no note', () => {
    render(<StartStepper current="weights" notes={{ program: '' }} />);
    const step = screen.getByTestId('start-stepper').querySelector('[data-step="program"]');
    expect(step?.textContent).not.toContain('·');
  });
});
