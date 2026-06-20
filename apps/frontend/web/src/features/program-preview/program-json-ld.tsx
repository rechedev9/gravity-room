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

// Equipment qualifiers that read better parenthesised, e.g.
// `bench_press_barbell` -> `Bench Press (Barbell)`.
const EQUIPMENT_SUFFIXES = new Set([
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'bodyweight',
  'kettlebell',
  'smith',
  'band',
]);

const titleCaseWord = (word: string): string =>
  word.length === 0 ? word : word[0].toUpperCase() + word.slice(1).toLowerCase();

/**
 * Turn a raw exercise id (`bench_press_barbell`) into a human-readable name
 * (`Bench Press (Barbell)`) for the HowTo JSON-LD. Crawlers and AI answer
 * engines index this text verbatim, so the raw snake_case id was indexing
 * machine identifiers instead of real exercise names.
 */
function humanizeExerciseId(id: string): string {
  const words = id.split(/[_-]+/).filter((w) => w.length > 0);
  if (words.length === 0) return id;
  const last = words[words.length - 1].toLowerCase();
  if (words.length > 1 && EQUIPMENT_SUFFIXES.has(last)) {
    return `${words.slice(0, -1).map(titleCaseWord).join(' ')} (${titleCaseWord(last)})`;
  }
  return words.map(titleCaseWord).join(' ');
}

function buildSteps(days: readonly ProgramDay[]): readonly HowToStep[] {
  return days.map((day, index) => {
    const summary = day.slots
      .map((slot) => slot.exerciseId)
      .filter((id, idx, arr) => arr.indexOf(id) === idx)
      .map(humanizeExerciseId)
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
