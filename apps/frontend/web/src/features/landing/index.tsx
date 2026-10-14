import { DEFAULT_PAGE_TITLE } from '@/lib/page-title';
import { ES_CONTENT } from './content';
import { LandingPageShell } from './landing-page-shell';

const ES_HEAD = {
  title: DEFAULT_PAGE_TITLE,
  description:
    'Crea un plan de fuerza gratis, sigue programas probados y deja que Gravity Room calcule pesos, series y ajustes de cada entrenamiento.',
  canonical: 'https://gravityroom.app/',
  ogLocale: 'es_ES',
  ogTitle: DEFAULT_PAGE_TITLE,
  ogDescription:
    'Crea un plan de fuerza gratis, sigue programas probados y deja que Gravity Room calcule pesos, series y ajustes de cada entrenamiento.',
  ogUrl: 'https://gravityroom.app/',
  lang: 'es',
  alternates: [
    { hreflang: 'es', href: 'https://gravityroom.app/' },
    { hreflang: 'en', href: 'https://gravityroom.app/en' },
    { hreflang: 'x-default', href: 'https://gravityroom.app/en' },
  ],
} as const;

export function LandingPage(): React.ReactNode {
  return <LandingPageShell content={ES_CONTENT} head={ES_HEAD} lang="es" />;
}
