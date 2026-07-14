import type { ReactNode } from 'react';
import { Link } from '@tanstack/react-router';
import { PROGRAM_CATALOG, PROGRAM_LEVELS, type ProgramLevel } from '@gzclp/domain/catalog';
import { useTranslation } from 'react-i18next';
import { useHead } from '@/hooks/use-head';
import { localizedProgramDescription, localizedProgramName } from '@/lib/catalog-display';

export type ProgramGuideLang = 'es' | 'en';
export type ProgramGuideKind = 'comparison' | 'progression';

const LEVEL_KEYS: Readonly<Record<ProgramLevel, string>> = {
  beginner: 'programs.card.level_beginner',
  intermediate: 'programs.card.level_intermediate',
  advanced: 'programs.card.level_advanced',
};

function alternates(esPath: string, enPath: string) {
  return [
    { hreflang: 'es', href: `https://gravityroom.app${esPath}` },
    { hreflang: 'en', href: `https://gravityroom.app${enPath}` },
    { hreflang: 'x-default', href: `https://gravityroom.app${enPath}` },
  ] as const;
}

function JsonLd({ value }: { readonly value: unknown }): ReactNode {
  return (
    <script type="application/ld+json">{JSON.stringify(value).replace(/</g, '\\u003c')}</script>
  );
}

function PublicHeader({ lang }: { readonly lang: ProgramGuideLang }): ReactNode {
  const { i18n } = useTranslation();
  const t = i18n.getFixedT(lang);
  return (
    <nav
      aria-label={t('programGuide.navigation')}
      className="flex flex-wrap gap-4 border-b border-rule pb-4 text-sm"
    >
      <Link to={lang === 'es' ? '/' : '/en'} className="font-bold text-main hover:text-accent">
        Gravity Room
      </Link>
      <Link
        to={lang === 'es' ? '/programas' : '/en/programs'}
        className="text-muted hover:text-main"
      >
        {t('programGuide.index.navLabel')}
      </Link>
      <Link
        to={lang === 'es' ? '/programas/gzclp-vs-stronglifts' : '/en/programs/gzclp-vs-stronglifts'}
        className="text-muted hover:text-main"
      >
        {t('programGuide.comparison.navLabel')}
      </Link>
      <Link
        to={
          lang === 'es' ? '/programas/progresion-automatica' : '/en/programs/automatic-progression'
        }
        className="text-muted hover:text-main"
      >
        {t('programGuide.progression.navLabel')}
      </Link>
    </nav>
  );
}

export function ProgramIndexPage({ lang }: { readonly lang: ProgramGuideLang }): ReactNode {
  const { i18n } = useTranslation();
  const t = i18n.getFixedT(lang);
  const path = lang === 'es' ? '/programas' : '/en/programs';
  useHead({
    title: t('programGuide.index.seoTitle'),
    description: t('programGuide.index.seoDescription'),
    canonical: `https://gravityroom.app${path}`,
    ogTitle: t('programGuide.index.seoTitle'),
    ogDescription: t('programGuide.index.seoDescription'),
    ogUrl: `https://gravityroom.app${path}`,
    ogLocale: lang === 'es' ? 'es_ES' : 'en_US',
    lang,
    alternates: alternates('/programas', '/en/programs'),
  });
  const active = PROGRAM_CATALOG.filter((program) => program.isActive);
  const list = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: t('programGuide.index.heading'),
    description: t('programGuide.index.seoDescription'),
    url: `https://gravityroom.app${path}`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: active.map((program, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: localizedProgramName(t, program.id, program.name),
        url: `https://gravityroom.app/programs/${program.id}`,
      })),
    },
  };
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-10">
      <JsonLd value={list} />
      <PublicHeader lang={lang} />
      <header className="space-y-3">
        <h1 className="font-display text-4xl sm:text-5xl text-title">
          {t('programGuide.index.heading')}
        </h1>
        <p className="max-w-3xl text-muted text-lg leading-relaxed">
          {t('programGuide.index.intro')}
        </p>
      </header>
      {PROGRAM_LEVELS.map((level) => {
        const programs = active.filter((program) => program.level === level);
        if (programs.length === 0) return null;
        return (
          <section key={level} aria-labelledby={`level-${level}`} className="space-y-4">
            <h2 id={`level-${level}`} className="font-display text-2xl text-title">
              {t(LEVEL_KEYS[level])}
            </h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {programs.map((program) => (
                <li key={program.id} className="border border-rule bg-card p-5 space-y-3">
                  <h3 className="font-display text-xl text-main">
                    {localizedProgramName(t, program.id, program.name)}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted">
                    {localizedProgramDescription(t, program.id, program.description)}
                  </p>
                  <Link
                    to="/programs/$programId"
                    params={{ programId: program.id }}
                    className="inline-flex font-bold text-accent hover:underline"
                  >
                    {t('programGuide.index.viewProgram')}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <section className="border-t border-rule pt-8 space-y-3">
        <h2 className="font-display text-2xl text-title">
          {t('programGuide.index.chooseHeading')}
        </h2>
        <p className="text-muted">{t('programGuide.index.chooseBody')}</p>
        <Link
          to={
            lang === 'es' ? '/programas/gzclp-vs-stronglifts' : '/en/programs/gzclp-vs-stronglifts'
          }
          className="font-bold text-accent hover:underline"
        >
          {t('programGuide.index.compareCta')}
        </Link>
      </section>
    </main>
  );
}

const GUIDE_PATHS = {
  comparison: { es: '/programas/gzclp-vs-stronglifts', en: '/en/programs/gzclp-vs-stronglifts' },
  progression: { es: '/programas/progresion-automatica', en: '/en/programs/automatic-progression' },
} as const;

export function ProgramGuidePage({
  lang,
  kind,
}: {
  readonly lang: ProgramGuideLang;
  readonly kind: ProgramGuideKind;
}): ReactNode {
  const { i18n } = useTranslation();
  const t = i18n.getFixedT(lang);
  const paths = GUIDE_PATHS[kind];
  const path = paths[lang];
  const prefix = `programGuide.${kind}`;
  const sections: unknown = t(`${prefix}.sections`, { returnObjects: true });
  const safeSections = Array.isArray(sections)
    ? sections.filter(
        (entry): entry is { heading: string; body: string } =>
          typeof entry === 'object' &&
          entry !== null &&
          'heading' in entry &&
          'body' in entry &&
          typeof entry.heading === 'string' &&
          typeof entry.body === 'string'
      )
    : [];
  useHead({
    title: t(`${prefix}.seoTitle`),
    description: t(`${prefix}.seoDescription`),
    canonical: `https://gravityroom.app${path}`,
    ogTitle: t(`${prefix}.seoTitle`),
    ogDescription: t(`${prefix}.seoDescription`),
    ogUrl: `https://gravityroom.app${path}`,
    ogLocale: lang === 'es' ? 'es_ES' : 'en_US',
    lang,
    alternates: alternates(paths.es, paths.en),
  });
  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: t(`${prefix}.heading`),
    description: t(`${prefix}.seoDescription`),
    url: `https://gravityroom.app${path}`,
    inLanguage: lang,
    publisher: { '@type': 'Organization', name: 'Gravity Room', url: 'https://gravityroom.app' },
  };
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <JsonLd value={article} />
      <PublicHeader lang={lang} />
      <article className="space-y-8">
        <header className="space-y-3">
          <h1 className="font-display text-4xl sm:text-5xl text-title">{t(`${prefix}.heading`)}</h1>
          <p className="text-lg leading-relaxed text-muted">{t(`${prefix}.answer`)}</p>
        </header>
        {safeSections.map((section) => (
          <section key={section.heading} className="space-y-2">
            <h2 className="font-display text-2xl text-title">{section.heading}</h2>
            <p className="leading-relaxed text-muted">{section.body}</p>
          </section>
        ))}
        <aside className="border border-accent/40 bg-card p-5 space-y-3">
          <h2 className="font-display text-2xl text-title">{t(`${prefix}.ctaHeading`)}</h2>
          <p className="text-muted">{t(`${prefix}.ctaBody`)}</p>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/programs/$programId"
              params={{ programId: 'gzclp' }}
              className="font-bold text-accent hover:underline"
            >
              GZCLP
            </Link>
            <Link
              to="/programs/$programId"
              params={{ programId: 'stronglifts-5x5' }}
              className="font-bold text-accent hover:underline"
            >
              StrongLifts 5x5
            </Link>
          </div>
        </aside>
      </article>
    </main>
  );
}
