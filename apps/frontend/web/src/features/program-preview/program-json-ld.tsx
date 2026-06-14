import type { ReactNode } from 'react';
import type { ProgramDefinition } from '@gzclp/domain/types/program';

type ProgramDay = ProgramDefinition['days'][number];

interface Props {
  readonly programId: string;
  readonly name: string;
  readonly description: string;
  readonly totalWorkouts: number;
  readonly workoutsPerWeek: number;
  readonly days: readonly ProgramDay[];
}

interface HowToStep {
  readonly '@type': 'HowToStep';
  readonly position: number;
  readonly name: string;
  readonly text: string;
}

function buildSteps(days: readonly ProgramDay[]): readonly HowToStep[] {
  return days.map((day, index) => {
    const summary = day.slots
      .map((slot) => slot.exerciseId)
      .filter((id, idx, arr) => arr.indexOf(id) === idx)
      .join(', ');
    return {
      '@type': 'HowToStep',
      position: index + 1,
      name: day.name,
      text: summary !== '' ? `Exercises: ${summary}` : day.name,
    };
  });
}

export function ProgramJsonLd({
  programId,
  name,
  description,
  totalWorkouts,
  workoutsPerWeek,
  days,
}: Props): ReactNode {
  const programUrl = `https://gravityroom.app/programs/${programId}`;
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `${name} — Workout Program`,
    description,
    url: programUrl,
    totalTime: `P${Math.ceil(totalWorkouts / workoutsPerWeek)}W`,
    step: buildSteps(days),
  };

  // Home › <program>. Enables breadcrumb rich results and tells crawlers the
  // page's place in the site hierarchy. Two levels: there is no standalone
  // /programs index route to sit in between.
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Gravity Room',
        item: 'https://gravityroom.app/',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name,
        item: programUrl,
      },
    ],
  };

  const encode = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c');

  return (
    <>
      <script type="application/ld+json">{encode(payload)}</script>
      <script type="application/ld+json">{encode(breadcrumb)}</script>
    </>
  );
}
