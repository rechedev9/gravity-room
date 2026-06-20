// exercise-article-view.test.tsx
import { describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { ExerciseArticleView } from './exercise-article-view';
import { squatArticle } from './content/squat';

describe('ExerciseArticleView', () => {
  it('renders the localized title as h1', () => {
    render(<ExerciseArticleView article={squatArticle} lang="en" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Squat');
  });
  it('renders one references list item per reference', () => {
    render(<ExerciseArticleView article={squatArticle} lang="es" />);
    const refs = screen.getByTestId('exercise-references');
    expect(refs.querySelectorAll('li')).toHaveLength(squatArticle.references.length);
  });
});
