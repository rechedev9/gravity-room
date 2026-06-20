// exercise-article-view.test.tsx
import { describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/react';
import { ExerciseArticleView } from './exercise-article-view';
import { placeholderArticle } from './content/_placeholder';

describe('ExerciseArticleView', () => {
  it('renders the localized title as h1', () => {
    render(<ExerciseArticleView article={placeholderArticle} lang="en" />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('Squat');
  });
  it('renders one references list item per reference', () => {
    render(<ExerciseArticleView article={placeholderArticle} lang="es" />);
    const refs = screen.getByTestId('exercise-references');
    expect(refs.querySelectorAll('li')).toHaveLength(placeholderArticle.references.length);
  });
});
