import { useEffect, type ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import type { ArticleLang } from '@gzclp/domain/schemas/exercise-article';
import { useHead } from '@/hooks/use-head';
import { useAuth } from '@/contexts/auth-context';
import { useGuest } from '@/contexts/guest-context';
import { getAllArticles } from './content/registry';
import { appendHreflangAlternates } from './hreflang';
import { BodyDiagram, pickBestView } from './body-diagram';

const COPY = {
  es: {
    title: 'Ejercicios — Gravity Room',
    heading: 'Wiki de ejercicios',
    intro: 'Guías basadas en evidencia para los ejercicios principales.',
    backToApp: 'Volver a la app',
  },
  en: {
    title: 'Exercises — Gravity Room',
    heading: 'Exercise wiki',
    intro: 'Evidence-based guides for the main lifts.',
    backToApp: 'Back to app',
  },
} as const;

export function ExerciseWikiIndexPage({ lang }: { readonly lang: ArticleLang }): ReactNode {
  const copy = COPY[lang];
  const base = lang === 'es' ? '/ejercicios' : '/en/exercises';
  const { user } = useAuth();
  const { isGuest } = useGuest();
  // A back-to-app affordance for users who reached the wiki mid-session, so they
  // don't lose their way out of the public marketing shell. Prerendered HTML
  // (no session) renders without it, keeping the public/SEO view unchanged.
  const inSession = user !== null || isGuest;
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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {inSession && (
        <Link
          to="/app"
          className="inline-flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-muted hover:text-main transition-colors"
        >
          <span aria-hidden="true">&larr;</span>
          {copy.backToApp}
        </Link>
      )}
      <header className="space-y-2">
        <h1 className="font-display text-4xl text-title">{copy.heading}</h1>
        <p className="text-muted">{copy.intro}</p>
      </header>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {getAllArticles().map((a) => (
          <li key={a.exerciseId}>
            <Link
              data-testid="exercise-card"
              to={`${base}/$slug`}
              params={{ slug: a.slug[lang] }}
              className="flex h-full items-start gap-3 border border-rule rounded-sm px-4 py-3 hover:border-accent transition-colors"
            >
              <BodyDiagram
                primary={a.primaryMuscles}
                secondary={a.secondaryMuscles}
                lang={lang}
                view={pickBestView(a.primaryMuscles)}
                variant="card"
                className="mt-0.5 w-9 shrink-0"
              />
              <span className="min-w-0">
                <span className="font-display text-xl text-main">{a.content[lang].title}</span>
                <span className="block text-sm text-muted">{a.content[lang].description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
