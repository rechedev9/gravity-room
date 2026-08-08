import { describe, it, expect, vi } from 'vitest';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { NextSetHero, type ProgramInstance } from './next-set-hero';

// Mock TanStack Router — tests don't need real navigation
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    className,
  }: {
    readonly children: React.ReactNode;
    readonly to: string;
    readonly className?: string;
  }) => createElement('a', { href: to, className }, children),
}));

describe('NextSetHero', () => {
  it('renders the empty hero when no program', () => {
    render(createElement(NextSetHero, { programInstance: null }));
    expect(screen.getByText(/ELIGE TU FORJA/i)).toBeInTheDocument();
  });

  it('renders the day-one hero when program exists but zero workouts logged', () => {
    const inst: ProgramInstance = {
      id: 'p1',
      programId: 'gzclp',
      name: 'GZCLP',
      status: 'active',
      results: {},
      nextWorkout: {
        dayIndex: 0,
        totalDays: 90,
        focusLifts: 'Sentadilla + Press Banca',
      },
    };
    render(createElement(NextSetHero, { programInstance: inst }));
    expect(screen.getByText(/DÍA UNO/i)).toBeInTheDocument();
  });

  it('renders the next-set hero with weight × reps when nextSet present', () => {
    const inst: ProgramInstance = {
      id: 'p1',
      programId: 'gzclp',
      name: 'GZCLP',
      status: 'active',
      results: { '0:d1-t1': 'success' },
      nextWorkout: {
        dayIndex: 16,
        totalDays: 90,
        focusLifts: 'Sentadilla + Press Banca',
      },
      nextSet: { weight: 82.5, reps: 5, label: 'first work set' },
    };
    render(createElement(NextSetHero, { programInstance: inst }));
    expect(screen.getByText('82.5 kg × 5')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /EMPEZAR ENTRENAMIENTO|START WORKOUT/i })
    ).toHaveAttribute('href', '/app/tracker');
    expect(screen.getByRole('link', { name: /VER PROGRAMA|VIEW PROGRAM/i })).toHaveAttribute(
      'href',
      '/app/programs'
    );
  });
});
