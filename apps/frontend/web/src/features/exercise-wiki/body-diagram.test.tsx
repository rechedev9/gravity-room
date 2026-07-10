import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EXERCISE_ARTICLES } from './content/registry';
import { BodyDiagram, MUSCLE_NAME_TO_REGION, OMITTED_MUSCLES, pickBestView } from './body-diagram';

describe('muscle-name coverage', () => {
  // Guards future articles: every anatomical muscle string used in the content
  // must be either mapped to an SVG region or consciously omitted, so the
  // diagram never silently drops (or crashes on) a real muscle.
  it('maps or omits every muscle referenced by any article', () => {
    const unhandled: string[] = [];
    for (const article of EXERCISE_ARTICLES) {
      for (const name of [...article.primaryMuscles, ...article.secondaryMuscles]) {
        const mapped = name in MUSCLE_NAME_TO_REGION;
        const omitted = OMITTED_MUSCLES.includes(name);
        if (!mapped && !omitted) unhandled.push(`${article.exerciseId}: ${name}`);
      }
    }
    expect(unhandled).toEqual([]);
  });
});

describe('pickBestView', () => {
  it('sends posterior-dominant lifts to the posterior view', () => {
    // deadlift: erector spinae + gluteus maximus + hamstrings are all posterior.
    const deadlift = EXERCISE_ARTICLES.find((a) => a.exerciseId === 'deadlift');
    expect(deadlift).toBeDefined();
    expect(pickBestView(deadlift!.primaryMuscles)).toBe('posterior');
  });

  it('defaults anterior for anterior-dominant or tied lifts', () => {
    const bench = EXERCISE_ARTICLES.find((a) => a.exerciseId === 'bench');
    const squat = EXERCISE_ARTICLES.find((a) => a.exerciseId === 'squat');
    expect(pickBestView(bench!.primaryMuscles)).toBe('anterior');
    expect(pickBestView(squat!.primaryMuscles)).toBe('anterior');
  });
});

describe('BodyDiagram render', () => {
  it('renders both figures with a legend and ignores unknown muscles', () => {
    render(
      <BodyDiagram
        primary={['quadriceps', 'not-a-real-muscle']}
        secondary={['hamstrings']}
        lang="es"
        view="both"
        showLegend
      />
    );
    // Two labelled figures (anterior + posterior).
    expect(screen.getByLabelText('Vista anterior')).toBeInTheDocument();
    expect(screen.getByLabelText('Vista posterior')).toBeInTheDocument();
    // Legend.
    expect(screen.getByText('Primarios')).toBeInTheDocument();
    expect(screen.getByText('Secundarios')).toBeInTheDocument();
  });

  it('renders a single figure and no legend in the card variant', () => {
    render(
      <BodyDiagram
        primary={['pectoralis major']}
        secondary={[]}
        lang="en"
        view="anterior"
        variant="card"
      />
    );
    expect(screen.getByLabelText('Anterior view')).toBeInTheDocument();
    expect(screen.queryByLabelText('Posterior view')).not.toBeInTheDocument();
    expect(screen.queryByText('Primary')).not.toBeInTheDocument();
  });
});
