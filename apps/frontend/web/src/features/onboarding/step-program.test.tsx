import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createElement } from 'react';
import type { CatalogEntry } from '@gzclp/domain/schemas/catalog';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    ...rest
  }: {
    readonly children: React.ReactNode;
    readonly [k: string]: unknown;
  }) => createElement('a', rest as Record<string, unknown>, children),
}));

import { StepProgram } from './step-program';

const ENTRIES: readonly CatalogEntry[] = [
  {
    id: 'gzclp',
    name: 'GZCLP',
    description: 'Progresión lineal por etapas.',
    author: 'Cody LeFever',
    category: 'strength',
    level: 'beginner',
    source: 'preset',
    totalWorkouts: 36,
    workoutsPerWeek: 4,
    cycleLength: 4,
  },
  {
    id: 'jaw',
    name: 'JAW',
    description: 'Bloques de seis semanas.',
    author: '',
    category: 'strength',
    level: 'intermediate',
    source: 'preset',
    totalWorkouts: 54,
    workoutsPerWeek: 3,
    cycleLength: 6,
  },
];

function renderStep(selectedId: string | null = null) {
  const onSelect = vi.fn();
  const onContinue = vi.fn();
  render(
    <StepProgram
      entries={ENTRIES}
      selectedId={selectedId}
      onSelect={onSelect}
      onContinue={onContinue}
    />
  );
  return { onSelect, onContinue };
}

describe('StepProgram', () => {
  afterEach(cleanup);

  it('exposes the cards as a radio group — the card selects, it does not commit', () => {
    const { onSelect, onContinue } = renderStep();

    const cards = screen.getAllByRole('radio');
    expect(cards).toHaveLength(2);

    fireEvent.click(cards[0]);
    expect(onSelect).toHaveBeenCalledWith('gzclp');
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('keeps a single advancing CTA, disabled until something is selected', () => {
    renderStep();
    expect(screen.getByTestId('start-program-continue')).toBeDisabled();
  });

  it('names the chosen program on the CTA once selected', () => {
    const { onContinue } = renderStep('gzclp');

    const cta = screen.getByTestId('start-program-continue');
    expect(cta).toBeEnabled();
    expect(cta.textContent).toContain('GZCLP');

    fireEvent.click(cta);
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it.each([
    { id: 'gzclp', checked: true },
    { id: 'jaw', checked: false },
  ])('marks $id aria-checked=$checked when gzclp is selected', ({ id, checked }) => {
    renderStep('gzclp');
    const card = screen
      .getAllByTestId('start-program-card')
      .find((el) => el.getAttribute('data-program-id') === id);
    expect(card).toHaveAttribute('aria-checked', String(checked));
  });

  it('offers the detail read as a demoted link, not a competing button', () => {
    renderStep('gzclp');
    const detail = screen.getByText(/leer el programa en detalle/i);
    expect(detail.tagName).toBe('A');
    expect(detail).toHaveAttribute('to', '/programs/$programId');
  });

  it('summarises each program without asking the user to leave the step', () => {
    renderStep();
    expect(screen.getByText('36 sesiones')).toBeInTheDocument();
    expect(screen.getByText('4 / semana')).toBeInTheDocument();
    expect(screen.getByText('Cody LeFever')).toBeInTheDocument();
  });
});
