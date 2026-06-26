// exercise-article-view.test.tsx
import { describe, expect, it } from 'vitest';
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
  it('renders an iframe whose src contains the video youtubeId', () => {
    render(<ExerciseArticleView article={squatArticle} lang="en" />);
    const iframe = document.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.src).toContain('t2b8UdqmlFs');
  });
  it('renders a variations section with the variation name when provided', () => {
    const articleWithVariations = {
      ...squatArticle,
      content: {
        ...squatArticle.content,
        en: {
          ...squatArticle.content.en,
          variations: [{ name: 'Low-bar squat', detail: 'More hip drive.' }],
        },
      },
    };
    render(<ExerciseArticleView article={articleWithVariations} lang="en" />);
    expect(screen.getByText('Low-bar squat')).toBeTruthy();
  });
});
