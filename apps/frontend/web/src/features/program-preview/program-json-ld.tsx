import type { ReactNode } from 'react';
import type { ProgramDefinition } from '@gzclp/domain/types/program';

type ProgramDay = ProgramDefinition['days'][number];

interface Props {
  readonly programId: string;
  readonly name: string;
  /** Prefer the SEO/factual description over themed lore for crawler extraction. */
  readonly description: string;
  readonly totalWorkouts: number;
  readonly workoutsPerWeek: number;
  readonly days: readonly ProgramDay[];
  /** exerciseId → human display name (from definition.exercises or i18n). */
  readonly exerciseNames?: Readonly<Record<string, string>>;
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

const KNOWN_ACRONYMS: Readonly<Record<string, string>> = {
  ohp: 'Overhead Press',
  dbrow: 'Dumbbell Row',
  latpulldown: 'Lat Pulldown',
  rdl: 'Romanian Deadlift',
  sldl: 'Stiff-Leg Deadlift',
  tbar: 'T-Bar Row',
};

const titleCaseWord = (word: string): string =>
  word.length === 0 ? word : word[0].toUpperCase() + word.slice(1).toLowerCase();

/**
 * Turn a raw exercise id (`bench_press_barbell`) into a human-readable name
 * (`Bench Press (Barbell)`) for the HowTo JSON-LD. Prefer the catalog/i18n
 * display name when provided — crawlers and AI answer engines index this text
 * verbatim.
 */
export function humanizeExerciseId(
  id: string,
  exerciseNames?: Readonly<Record<string, string>>
): string {
  const fromMap = exerciseNames?.[id];
  if (fromMap !== undefined && fromMap.trim() !== '') return fromMap;

  const known = KNOWN_ACRONYMS[id.toLowerCase()];
  if (known !== undefined) return known;

  const words = id.split(/[_-]+/).filter((w) => w.length > 0);
  if (words.length === 0) return id;
  const last = words[words.length - 1].toLowerCase();
  if (words.length > 1 && EQUIPMENT_SUFFIXES.has(last)) {
    return `${words.slice(0, -1).map(titleCaseWord).join(' ')} (${titleCaseWord(last)})`;
  }
  return words.map(titleCaseWord).join(' ');
}

function buildSteps(
  days: readonly ProgramDay[],
  exerciseNames?: Readonly<Record<string, string>>
): readonly HowToStep[] {
  return days.map((day, index) => {
    const summary = day.slots
      .map((slot) => slot.exerciseId)
      .filter((id, idx, arr) => arr.indexOf(id) === idx)
      .map((id) => humanizeExerciseId(id, exerciseNames))
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
  exerciseNames,
}: Props): ReactNode {
  const programUrl = `https://gravityroom.app/programs/${programId}`;
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: `${name} — Workout Program`,
    description,
    url: programUrl,
    totalTime: `P${Math.ceil(totalWorkouts / workoutsPerWeek)}W`,
    step: buildSteps(days, exerciseNames),
  };

  // Home › Programs › <program>. The public program index is the stable hub
  // linking every catalog page, so crawlers can understand the hierarchy.
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
        name: 'Programs',
        item: 'https://gravityroom.app/en/programs',
      },
      {
        '@type': 'ListItem',
        position: 3,
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
