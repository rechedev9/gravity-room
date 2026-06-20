import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExerciseJsonLd } from './exercise-json-ld';
import { placeholderArticle } from './content/_placeholder';

function parseLd(markup: string): Record<string, unknown> {
  const start = markup.indexOf('<script type="application/ld+json">');
  const end = markup.indexOf('</script>', start);
  if (start === -1 || end === -1) throw new Error('no ld+json script');
  const content = markup.slice(start + '<script type="application/ld+json">'.length, end);
  return JSON.parse(content.replace(/\\u003c/g, '<')) as Record<string, unknown>;
}

describe('ExerciseJsonLd', () => {
  it('emits an Article whose citation count matches references', () => {
    const html = renderToStaticMarkup(<ExerciseJsonLd article={placeholderArticle} lang="es" />);
    const ld = parseLd(html);
    expect(ld['@type']).toBe('Article');
    expect(Array.isArray(ld.citation)).toBe(true);
    expect(ld.citation).toHaveLength(placeholderArticle.references.length);
  });
  it('uses the localized canonical url', () => {
    const html = renderToStaticMarkup(<ExerciseJsonLd article={placeholderArticle} lang="en" />);
    const ld = parseLd(html);
    expect(ld.url).toBe('https://gravityroom.app/en/exercises/squat');
  });
});
