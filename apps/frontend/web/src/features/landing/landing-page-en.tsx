import { EN_CONTENT } from './content';
import { LandingPageShell } from './landing-page-shell';

const EN_HEAD = {
  title: 'Gravity Room — Free Strength Plans with Automatic Progression',
  description:
    'Build a free strength plan, follow proven programs, and let Gravity Room calculate weights, sets, and adjustments for every workout.',
  canonical: 'https://gravityroom.app/en',
  ogLocale: 'en_US',
  ogTitle: 'Gravity Room — Free Strength Plans with Automatic Progression',
  ogDescription:
    'Build a free strength plan, follow proven programs, and let Gravity Room calculate weights, sets, and adjustments for every workout.',
  ogUrl: 'https://gravityroom.app/en',
  lang: 'en',
  alternates: [
    { hreflang: 'es', href: 'https://gravityroom.app/' },
    { hreflang: 'en', href: 'https://gravityroom.app/en' },
    { hreflang: 'x-default', href: 'https://gravityroom.app/en' },
  ],
} as const;

export function LandingPageEn(): React.ReactNode {
  return <LandingPageShell content={EN_CONTENT} head={EN_HEAD} lang="en" />;
}
