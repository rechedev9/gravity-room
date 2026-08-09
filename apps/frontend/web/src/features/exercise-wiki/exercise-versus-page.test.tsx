import { describe, expect, it, vi } from 'vitest';
import { createElement, type ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    ...props
  }: {
    readonly children: ReactNode;
    readonly [k: string]: unknown;
  }) => {
    const anchorProps = { ...props };
    delete anchorProps.to;
    delete anchorProps.params;
    return createElement('a', anchorProps, children);
  },
}));

import { ExerciseVersusPage } from './exercise-versus-page';

describe('ExerciseVersusPage', () => {
  it('renders the comparator and produces a result', () => {
    render(<ExerciseVersusPage lang="es" />);
    expect(screen.getByTestId('versus-exercise-a')).toBeInTheDocument();
    expect(screen.getByTestId('versus-exercise-b')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('versus-submit'));
    expect(screen.getByTestId('versus-result')).toBeInTheDocument();
    expect(screen.getByTestId('versus-score-duel')).toBeInTheDocument();
    expect(screen.getByTestId('versus-axis-breakdown')).toBeInTheDocument();
  });

  it('swaps sides and clears a previous result', () => {
    render(<ExerciseVersusPage lang="es" />);
    const selectA = screen.getByTestId('versus-exercise-a') as HTMLSelectElement;
    const selectB = screen.getByTestId('versus-exercise-b') as HTMLSelectElement;
    const beforeA = selectA.value;
    const beforeB = selectB.value;
    fireEvent.click(screen.getByTestId('versus-submit'));
    expect(screen.getByTestId('versus-result')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('versus-swap'));
    expect(selectA.value).toBe(beforeB);
    expect(selectB.value).toBe(beforeA);
    expect(screen.queryByTestId('versus-result')).not.toBeInTheDocument();
  });

  it('does not show transfer-to-flat-bench as a pro when bench is selected', () => {
    render(<ExerciseVersusPage lang="es" />);
    fireEvent.click(screen.getByTestId('versus-submit'));
    expect(screen.getByTestId('versus-result')).toBeInTheDocument();
    expect(screen.queryByText(/transferencia a banca plana/i)).not.toBeInTheDocument();
  });
});
