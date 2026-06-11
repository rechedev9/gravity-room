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
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `${name} — Workout Program`,
    description,
    url: `https://gravityroom.app/programs/${programId}`,
    totalTime: `P${Math.ceil(totalWorkouts / workoutsPerWeek)}W`,
    step: buildSteps(days),
  };
  const jsonLdText = JSON.stringify(payload).replace(/</g, '\\u003c');

  return <script type="application/ld+json">{jsonLdText}</script>;
}
