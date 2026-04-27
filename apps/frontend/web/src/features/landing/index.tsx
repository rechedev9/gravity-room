import { ES_CONTENT } from './content';
import { LandingPageShell } from './landing-page-shell';

const ES_HEAD = {
  title: 'Gravity Room — Programas de Entrenamiento con Progresión Automática',
  description:
    'Deja de adivinar en el gimnasio. Programas de entrenamiento con progresión automática de peso, series y repeticiones. 100% gratis.',
  canonical: 'https://gravityroom.app/',
  ogLocale: 'es_ES',
  ogTitle: 'Gravity Room — Programas de Entrenamiento con Progresión Automática',
  ogDescription:
    'Deja de adivinar en el gimnasio. Programas de entrenamiento con progresión automática de peso, series y repeticiones. 100% gratis.',
  ogUrl: 'https://gravityroom.app/',
  lang: 'es',
} as const;

export function LandingPage(): React.ReactNode {
  return <LandingPageShell content={ES_CONTENT} head={ES_HEAD} lang="es" />;
}
