import { EN_CONTENT } from './content';
import { LandingPageShell } from './landing-page-shell';

const EN_HEAD = {
  title: 'Gravity Room — Weightlifting Programs with Automatic Progression',
  description:
    'Stop guessing at the gym. Follow proven weightlifting programs that automatically adjust weight, sets, and reps. 100% free.',
  canonical: 'https://gravityroom.app/en',
  ogLocale: 'en_US',
  ogTitle: 'Gravity Room — Weightlifting Programs with Automatic Progression',
  ogDescription:
    'Stop guessing at the gym. Follow proven weightlifting programs that automatically adjust weight, sets, and reps. 100% free.',
  ogUrl: 'https://gravityroom.app/en',
  lang: 'en',
} as const;

export function LandingPageEn(): React.ReactNode {
  return <LandingPageShell content={EN_CONTENT} head={EN_HEAD} lang="en" />;
}
