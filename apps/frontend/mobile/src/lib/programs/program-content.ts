import type { CatalogEntry, ProgramDefinition } from '@gzclp/domain';
import type { TFunction } from 'i18next';

const PROGRAM_CONTENT_IDS = [
  'gzclp',
  'hexan-ppl',
  'stronglifts-5x5',
  'phraks-greyskull-lp',
  '531-boring-but-big',
  '531-for-beginners',
  'phul',
  'nivel-7',
  'caparazon-de-tortuga',
  '365-programmare-lipertrofia',
  'la-sala-del-tiempo',
  'sala-del-tiempo-1',
  'sala-del-tiempo-2',
  'sala-del-tiempo-3',
  'tenkaichi-budokai-sentadilla',
  'tenkaichi-budokai-press-banca',
  'tenkaichi-budokai-peso-muerto',
  'tenkaichi-budokai-solo-banca',
  'tenkaichi-budokai-veterano',
  'furia-oscura',
] as const;

type ProgramContentId = (typeof PROGRAM_CONTENT_IDS)[number];

const EXERCISE_CONTENT_KEYS = {
  squat: 'squat',
  bench: 'bench',
  deadlift: 'deadlift',
  ohp: 'ohp',
  latpulldown: 'latpulldown',
  dbrow: 'dbrow',
} as const satisfies Readonly<Record<string, string>>;

const FIELD_CONTENT_KEYS = EXERCISE_CONTENT_KEYS;

const TIER_CONTENT_KEYS = {
  t1: 't1',
  t2: 't2',
  t3: 't3',
  primary: 'primary',
  secondary: 'secondary',
  accessory: 'accessory',
} as const satisfies Readonly<Record<string, string>>;

function isProgramContentId(value: string): value is ProgramContentId {
  return PROGRAM_CONTENT_IDS.some((id) => id === value);
}

function readKnownKey(keys: Readonly<Record<string, string>>, value: string): string | null {
  return Object.prototype.hasOwnProperty.call(keys, value) ? (keys[value] ?? null) : null;
}

export interface LocalizedCatalogEntry {
  readonly description: string;
  readonly level: string;
  readonly name: string;
}

export function localizeCatalogEntry(entry: CatalogEntry, t: TFunction): LocalizedCatalogEntry {
  const contentId = isProgramContentId(entry.id) ? entry.id : null;
  return {
    name:
      contentId === null
        ? t('program_content.fallback.program_name')
        : t(`program_content.catalog.${contentId}.name`),
    description:
      contentId === null
        ? t('program_content.fallback.program_description')
        : t(`program_content.catalog.${contentId}.description`),
    level: t(`program_content.level.${entry.level}`),
  };
}

export function localizeDefinitionName(definition: ProgramDefinition, t: TFunction): string {
  return localizeCatalogEntry(
    {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      author: definition.author,
      category: definition.category,
      level: 'intermediate',
      source: definition.source,
      totalWorkouts: definition.totalWorkouts,
      workoutsPerWeek: definition.workoutsPerWeek,
      cycleLength: definition.cycleLength,
    },
    t
  ).name;
}

export function localizeDefinitionDescription(definition: ProgramDefinition, t: TFunction): string {
  return localizeCatalogEntry(
    {
      id: definition.id,
      name: definition.name,
      description: definition.description,
      author: definition.author,
      category: definition.category,
      level: 'intermediate',
      source: definition.source,
      totalWorkouts: definition.totalWorkouts,
      workoutsPerWeek: definition.workoutsPerWeek,
      cycleLength: definition.cycleLength,
    },
    t
  ).description;
}

export function localizeDayName(index: number, t: TFunction): string {
  return t('program_content.day', { number: index + 1 });
}

export function localizeExerciseName(exerciseId: string, index: number, t: TFunction): string {
  const key = readKnownKey(EXERCISE_CONTENT_KEYS, exerciseId);
  return key === null
    ? t('program_content.fallback.exercise', { number: index + 1 })
    : t(`program_content.exercises.${key}`);
}

export function localizeFieldLabel(fieldKey: string, index: number, t: TFunction): string {
  const key = readKnownKey(FIELD_CONTENT_KEYS, fieldKey);
  return key === null
    ? t('program_content.fallback.setup_field', { number: index + 1 })
    : t(`program_content.exercises.${key}`);
}

export function localizeSelectOption(index: number, t: TFunction): string {
  return t('program_content.option', { number: index + 1 });
}

export function localizeTier(tier: string, t: TFunction): string {
  const key = readKnownKey(TIER_CONTENT_KEYS, tier.toLowerCase());
  return key === null ? t('program_content.tier.other') : t(`program_content.tier.${key}`);
}
