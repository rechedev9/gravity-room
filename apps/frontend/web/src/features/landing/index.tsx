import { ES_CONTENT } from './content';
import { LandingPageShell } from './landing-page-shell';

const ES_HEAD = {
  title: 'Gravity Room — Planes de fuerza gratis con progresión automática',
  description:
    'Crea un plan de fuerza gratis, sigue programas probados y deja que Gravity Room calcule pesos, series y ajustes de cada entrenamiento.',
  canonical: 'https://gravityroom.app/',
  ogLocale: 'es_ES',
  ogTitle: 'Gravity Room — Planes de fuerza gratis con progresión automática',
  ogDescription:
    'Crea un plan de fuerza gratis, sigue programas probados y deja que Gravity Room calcule pesos, series y ajustes de cada entrenamiento.',
  ogUrl: 'https://gravityroom.app/',
  lang: 'es',
} as const;

export function LandingPage(): React.ReactNode {
  return <LandingPageShell content={ES_CONTENT} head={ES_HEAD} lang="es" />;
}
