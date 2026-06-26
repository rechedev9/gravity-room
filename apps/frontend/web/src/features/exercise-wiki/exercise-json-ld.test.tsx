import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExerciseJsonLd } from './exercise-json-ld';
import { squatArticle } from './content/squat';

const LD_OPEN = '<script type="application/ld+json">';
const LD_CLOSE = '</script>';

function parseLd(markup: string, index = 0): Record<string, unknown> {
  let pos = 0;
  let found = -1;
  for (let i = 0; i <= index; i++) {
    found = markup.indexOf(LD_OPEN, pos);
    if (found === -1) throw new Error(`no ld+json script at index ${String(i)}`);
    pos = found + LD_OPEN.length;
  }
  const end = markup.indexOf(LD_CLOSE, pos);
  if (end === -1) throw new Error('no closing script tag');
  const content = markup.slice(pos, end);
  return JSON.parse(content.replace(/\\u003c/g, '<')) as Record<string, unknown>;
}

describe('ExerciseJsonLd', () => {
  it('emits an Article whose citation count matches references', () => {
    const html = renderToStaticMarkup(<ExerciseJsonLd article={squatArticle} lang="es" />);
    const ld = parseLd(html);
    expect(ld['@type']).toBe('Article');
    expect(Array.isArray(ld.citation)).toBe(true);
    expect(ld.citation).toHaveLength(squatArticle.references.length);
  });
  it('uses the localized canonical url', () => {
    const html = renderToStaticMarkup(<ExerciseJsonLd article={squatArticle} lang="en" />);
    const ld = parseLd(html);
    expect(ld.url).toBe('https://gravityroom.app/en/exercises/squat');
  });
  it('uses the es localized canonical url', () => {
    const html = renderToStaticMarkup(<ExerciseJsonLd article={squatArticle} lang="es" />);
    const ld = parseLd(html);
    expect(ld.url).toBe('https://gravityroom.app/ejercicios/sentadilla');
  });
  it('emits a BreadcrumbList as the second ld+json script', () => {
    const html = renderToStaticMarkup(<ExerciseJsonLd article={squatArticle} lang="en" />);
    const ld = parseLd(html, 1);
    expect(ld['@type']).toBe('BreadcrumbList');
    const items = ld.itemListElement as Array<Record<string, unknown>>;
    expect(items).toHaveLength(2);
    expect(items[1].item).toBe('https://gravityroom.app/en/exercises/squat');
  });
  it('emits a VideoObject as the third ld+json script with the correct embedUrl', () => {
    const html = renderToStaticMarkup(<ExerciseJsonLd article={squatArticle} lang="en" />);
    const ld = parseLd(html, 2);
    expect(ld['@type']).toBe('VideoObject');
    expect(ld.embedUrl as string).toContain('t2b8UdqmlFs');
  });
});
