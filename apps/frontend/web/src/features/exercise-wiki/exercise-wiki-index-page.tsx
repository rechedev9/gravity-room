import { useEffect, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import type { ArticleLang } from '@gzclp/domain/schemas/exercise-article';
import { useHead } from '@/hooks/use-head';
import { getAllArticles } from './content/registry';
import { appendHreflangAlternates } from './hreflang';

const COPY = {
  es: {
    title: 'Ejercicios — Gravity Room',
    heading: 'Wiki de ejercicios',
    intro: 'Guías basadas en evidencia para los ejercicios principales.',
  },
  en: {
    title: 'Exercises — Gravity Room',
    heading: 'Exercise wiki',
    intro: 'Evidence-based guides for the main lifts.',
  },
} as const;

export function ExerciseWikiIndexPage({ lang }: { readonly lang: ArticleLang }): ReactNode {
  const copy = COPY[lang];
  const base = lang === 'es' ? '/ejercicios' : '/en/exercises';
  useHead({
    title: copy.title,
    description: copy.intro,
    canonical: `https://gravityroom.app${base}`,
    lang,
  });
  useEffect(() => {
    return appendHreflangAlternates([
      { hreflang: 'es', href: 'https://gravityroom.app/ejercicios' },
      { hreflang: 'en', href: 'https://gravityroom.app/en/exercises' },
      { hreflang: 'x-default', href: 'https://gravityroom.app/en/exercises' },
    ]);
  }, []);
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="font-display text-4xl text-title">{copy.heading}</h1>
        <p className="text-muted">{copy.intro}</p>
      </header>
      <ul className="space-y-3">
        {getAllArticles().map((a) => (
          <li key={a.exerciseId}>
            <Link
              data-testid="exercise-card"
              to={`${base}/$slug`}
              params={{ slug: a.slug[lang] }}
              className="block border border-rule rounded-sm px-4 py-3 hover:border-accent transition-colors"
            >
              <span className="font-display text-xl text-main">{a.content[lang].title}</span>
              <span className="block text-sm text-muted">{a.content[lang].description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
