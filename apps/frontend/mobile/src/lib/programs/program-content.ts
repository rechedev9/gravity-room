import type { CatalogEntry, ProgramDefinition } from '@gzclp/domain';
import type { TFunction } from 'i18next';

import type { SupportedLanguage } from '../i18n';
import { formatLocalizedWeight } from './localized-weight-input';

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
  press_mil: 'ohp',
  latpulldown: 'latpulldown',
  lat_pulldown: 'latpulldown',
  dbrow: 'dbrow',
  pullup: 'pullup',
  bent_over_row: 'bent_over_row',
  seated_row: 'seated_row',
  face_pull: 'face_pull',
  hammer_curl: 'hammer_curl',
  incline_curl: 'incline_curl',
  incline_db_press: 'incline_db_press',
  triceps_pushdown: 'triceps_pushdown',
  triceps_extension: 'triceps_extension',
  lateral_raise: 'lateral_raise',
  barbell_rdl: 'barbell_rdl',
  dumbbell_rdl: 'dumbbell_rdl',
  bulgarian_split_squat: 'bulgarian_split_squat',
  cable_pull_through: 'cable_pull_through',
  standing_calf_raise: 'standing_calf_raise',
  incline_row: 'incline_row',
  lying_bicep_curl: 'lying_bicep_curl',
  seated_leg_curl: 'seated_leg_curl',
  plank: 'plank',
  reverse_plank: 'reverse_plank',
  sit_up_decline: 'sit_up_decline',
  leg_curl_prone: 'leg_curl_prone',
  hyperextension: 'hyperextension',
  bulgarian_split_squat_slow: 'bulgarian_split_squat_slow',
  calf_raise_proprioceptive: 'calf_raise_proprioceptive',
  squat_bodyweight: 'squat_bodyweight',
  lateral_raise_band: 'lateral_raise_band',
  french_press_bench: 'french_press_bench',
  rear_delt_band: 'rear_delt_band',
  pulley_band_seated: 'pulley_band_seated',
  pushup_isometric: 'pushup_isometric',
  bench_pushups: 'bench_pushups',
  deadlift_partial_blocks: 'deadlift_partial_blocks',
  leg_press_isometric: 'leg_press_isometric',
  deadlift_isometric: 'deadlift_isometric',
  squat_barbell: 'squat_barbell',
  bench_press_barbell: 'bench_press_barbell',
  deadlift_barbell: 'deadlift_barbell',
} as const satisfies Readonly<Record<string, string>>;

const TIER_CONTENT_KEYS = {
  t1: 't1',
  t2: 't2',
  t3: 't3',
  main: 'main',
  supplemental: 'supplemental',
  power: 'power',
  hypertrophy: 'hypertrophy',
  core: 'core',
  activation: 'activation',
  proprioception: 'proprioception',
  fundamental: 'fundamental',
  comp: 'comp',
  gpp: 'gpp',
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

function humanizeIdentifier(value: string): string {
  const words = value
    .split(/[-_]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0);
  if (words.length === 0) {
    return value;
  }
  return words
    .map((word) => {
      const normalized = word.toLowerCase();
      if (normalized === 'tm') return 'TM';
      if (normalized === 'rm' || normalized === '1rm') return '1RM';
      if (normalized === 'rdl') return 'RDL';
      if (normalized === 'gpp') return 'GPP';
      return `${word.charAt(0).toUpperCase()}${word.slice(1)}`;
    })
    .join(' ');
}

function localizeEnglishDayName(dayName: string, t: TFunction): string {
  const replacements: readonly [RegExp, string][] = [
    [/\bSem\.\s*/gu, `${t('program_content.semantic.week')} `],
    [/\bSemana\b/giu, t('program_content.semantic.week')],
    [/\bD[ií]a\b/giu, t('program_content.semantic.day')],
    [/\bSentadilla\b/giu, t('program_content.exercises.squat')],
    [/\bPress Banca\b/giu, t('program_content.exercises.bench')],
    [/\bBanca\b/giu, t('program_content.exercises.bench')],
    [/\bPeso Muerto\b/giu, t('program_content.exercises.deadlift')],
    [/\bHombros\/Tr[ií]ceps\b/giu, t('program_content.semantic.shoulders_triceps')],
    [/\bEspalda\/Gemelo\b/giu, t('program_content.semantic.back_calves')],
    [/\bPecho\/B[ií]ceps\b/giu, t('program_content.semantic.chest_biceps')],
    [/\bPierna\b/giu, t('program_content.semantic.legs')],
    [/\bFuerza Superior\b/giu, t('program_content.semantic.upper_power')],
    [/\bFuerza Inferior\b/giu, t('program_content.semantic.lower_power')],
    [/\bHipertrofia Superior\b/giu, t('program_content.semantic.upper_hypertrophy')],
    [/\bHipertrofia Inferior\b/giu, t('program_content.semantic.lower_hypertrophy')],
    [/\bDescarga\b/giu, t('program_content.semantic.deload')],
    [/\bLigero\b/giu, t('program_content.semantic.light')],
    [/\bRecuperaci[oó]n\b/giu, t('program_content.semantic.recovery')],
    [/\bTest M[aá]ximo\b/giu, t('program_content.semantic.max_test')],
    [/\bBloque\b/giu, t('program_content.semantic.block')],
  ];
  return replacements.reduce(
    (localized, [pattern, replacement]) => localized.replace(pattern, replacement),
    dayName
  );
}

export interface LocalizedCatalogEntry {
  readonly description: string;
  readonly level: string;
  readonly name: string;
}

export function localizeCatalogEntry(entry: CatalogEntry, t: TFunction): LocalizedCatalogEntry {
  const contentId = isProgramContentId(entry.id) ? entry.id : null;
  return {
    name: contentId === null ? entry.name : t(`program_content.catalog.${contentId}.name`),
    description:
      contentId === null
        ? entry.description
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

export function localizeDayName(
  programId: string,
  dayName: string,
  index: number,
  t: TFunction,
  language: SupportedLanguage
): string {
  if (dayName.trim().length === 0) {
    return t('program_content.fallback.day', {
      program: humanizeIdentifier(programId),
      number: index + 1,
    });
  }
  return language === 'es' ? dayName : localizeEnglishDayName(dayName, t);
}

export function localizeExerciseName(
  exerciseId: string,
  canonicalName: string | undefined,
  t: TFunction,
  language: SupportedLanguage
): string {
  const key = readKnownKey(EXERCISE_CONTENT_KEYS, exerciseId);
  if (key !== null) {
    return t(`program_content.exercises.${key}`);
  }
  if (language === 'es' && canonicalName !== undefined && canonicalName.trim().length > 0) {
    return canonicalName;
  }
  return humanizeIdentifier(exerciseId);
}

export function localizeFieldLabel(
  programId: string,
  fieldKey: string,
  canonicalLabel: string,
  t: TFunction,
  language: SupportedLanguage
): string {
  if (fieldKey === 'gender') return t('program_content.fields.gender');
  if (fieldKey === 'rounding') return t('program_content.fields.rounding');
  if (fieldKey === 'bodyweight') return t('program_content.fields.bodyweight');

  const jawMatch = /^(squat|bench|deadlift)_jaw_b([123])_tm$/u.exec(fieldKey);
  if (jawMatch) {
    const lift = jawMatch[1];
    const block = jawMatch[2];
    if (lift && block) {
      return t('program_content.fields.training_max_block', {
        exercise: localizeExerciseName(lift, undefined, t, language),
        block,
      });
    }
  }

  const oneRepMaxMatch = /^(squat|bench|deadlift)1rm$/u.exec(fieldKey);
  if (oneRepMaxMatch?.[1]) {
    return t('program_content.fields.one_rep_max', {
      exercise: localizeExerciseName(oneRepMaxMatch[1], undefined, t, language),
    });
  }

  const trainingMaxMatch = /^(.*)_tm$/u.exec(fieldKey);
  if (trainingMaxMatch?.[1]) {
    return t('program_content.fields.training_max', {
      exercise: localizeExerciseName(trainingMaxMatch[1], undefined, t, language),
    });
  }

  const startingWeightMatch = /^(?:fz_)?(squat|bench|deadlift)_start$/u.exec(fieldKey);
  if (startingWeightMatch?.[1]) {
    return t('program_content.fields.starting_weight', {
      exercise: localizeExerciseName(startingWeightMatch[1], undefined, t, language),
    });
  }

  if (programId === 'nivel-7' && ['press_mil', 'bench', 'squat', 'deadlift'].includes(fieldKey)) {
    return t('program_content.fields.target_record', {
      exercise: localizeExerciseName(fieldKey, undefined, t, language),
    });
  }

  const exerciseKey = readKnownKey(EXERCISE_CONTENT_KEYS, fieldKey);
  if (exerciseKey !== null) {
    return t(`program_content.exercises.${exerciseKey}`);
  }
  if (language === 'es' && canonicalLabel.trim().length > 0) {
    return canonicalLabel;
  }
  return humanizeIdentifier(fieldKey);
}

export function localizeSelectOption(
  fieldKey: string,
  value: string,
  canonicalLabel: string,
  t: TFunction,
  language: SupportedLanguage
): string {
  if (fieldKey === 'gender' && (value === 'male' || value === 'female')) {
    return t(`program_content.options.gender.${value}`);
  }
  if (fieldKey === 'rounding') {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric >= 0) {
      return t('program_content.options.rounding', {
        value: formatLocalizedWeight(numeric, language),
      });
    }
  }
  return canonicalLabel.trim().length > 0 ? canonicalLabel : humanizeIdentifier(value);
}

export function localizeTier(tier: string, t: TFunction): string {
  const key = readKnownKey(TIER_CONTENT_KEYS, tier.toLowerCase());
  return key === null ? t('program_content.tier.other') : t(`program_content.tier.${key}`);
}
