import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import type { ArticleLang } from '@gzclp/domain/schemas/exercise-article';
import { useHead } from '@/hooks/use-head';

export function ArticleNotFound({ lang }: { readonly lang: ArticleLang }): ReactNode {
  useHead({
    title:
      lang === 'es'
        ? 'Ejercicio no encontrado — Gravity Room'
        : 'Exercise not found — Gravity Room',
    robots: 'noindex, follow',
    lang,
  });

  const backTo = lang === 'es' ? '/ejercicios' : '/en/exercises';

  return (
    <div className="text-center py-16 px-4">
      <p className="text-muted mb-6 text-sm">
        {lang === 'es' ? 'Ejercicio no encontrado.' : 'Exercise not found.'}
      </p>
      <Link to={backTo} className="text-accent text-sm">
        {lang === 'es' ? 'Volver' : 'Back'}
      </Link>
    </div>
  );
}
