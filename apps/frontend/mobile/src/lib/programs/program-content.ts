import { ProgramWeightValueSchema, type CatalogEntry, type ProgramDefinition } from '@gzclp/domain';
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

export interface ProgramContentOrigin {
  readonly id: string;
  readonly source: string;
}

const CANONICAL_POSITIVE_DECIMAL_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

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

const SIMPLE_DAY_CONTENT_KEYS = {
  'Día 1': 'day_1',
  'Día 2': 'day_2',
  'Día 3': 'day_3',
  'Día 4': 'day_4',
  'Workout A': 'workout_a',
  'Workout B': 'workout_b',
  'Pull A': 'pull_a',
  'Pull B': 'pull_b',
  'Push A': 'push_a',
  'Push B': 'push_b',
  'Legs A': 'legs_a',
  'Legs B': 'legs_b',
  'Fuerza Superior': 'upper_power',
  'Fuerza Inferior': 'lower_power',
  'Hipertrofia Superior': 'upper_hypertrophy',
  'Hipertrofia Inferior': 'lower_hypertrophy',
  'Lun — Hombros/Tríceps': 'monday_shoulders_triceps',
  'Mar — Espalda/Gemelo': 'tuesday_back_calves',
  'Jue — Pecho/Bíceps': 'thursday_chest_biceps',
  'Vie — Pierna': 'friday_legs',
} as const satisfies Readonly<Record<string, string>>;

const DAY_FOCUS_CONTENT_KEYS = {
  Accesorios: 'accessories',
  Banca: 'bench',
  'Banca/Muerto': 'bench_deadlift',
  BENCH: 'bench',
  DEADLIFT: 'deadlift',
  Ligero: 'light',
  'Peso Muerto': 'deadlift',
  'Press Banca': 'bench',
  'Press Militar': 'ohp',
  Sentadilla: 'squat',
  SQUAT: 'squat',
} as const satisfies Readonly<Record<string, string>>;

function isProgramContentId(value: string): value is ProgramContentId {
  return PROGRAM_CONTENT_IDS.some((id) => id === value);
}

function canonicalContentId(origin: ProgramContentOrigin): ProgramContentId | null {
  return origin.source === 'preset' && isProgramContentId(origin.id) ? origin.id : null;
}

function readKnownKey(keys: Readonly<Record<string, string>>, value: string): string | null {
  return Object.prototype.hasOwnProperty.call(keys, value) ? (keys[value] ?? null) : null;
}

function readRequiredTranslation(t: TFunction, key: string): string {
  const translated = t(key, { defaultValue: '' }).trim();
  if (translated.length === 0) {
    throw new Error(`Missing canonical program-content translation: ${key}`);
  }
  return translated;
}

function readExternalLabel(label: string | undefined, fallbackKey: string, t: TFunction): string {
  const trimmed = label?.trim() ?? '';
  const looksLikeInternalIdentifier = /^[a-z0-9]+(?:_[a-z0-9]+)+$/u.test(trimmed);
  return trimmed.length > 0 && !looksLikeInternalIdentifier
    ? trimmed
    : readRequiredTranslation(t, fallbackKey);
}

function localizeDayFocus(focus: string, t: TFunction): string | null {
  const key = readKnownKey(DAY_FOCUS_CONTENT_KEYS, focus);
  return key === null ? null : readRequiredTranslation(t, `program_content.day_focus.${key}`);
}

function localizeCanonicalDayName(dayName: string, t: TFunction): string | null {
  const simpleKey = readKnownKey(SIMPLE_DAY_CONTENT_KEYS, dayName);
  if (simpleKey !== null) {
    return readRequiredTranslation(t, `program_content.days.simple.${simpleKey}`);
  }

  const fiveThreeOne = /^Sem\. (\d+) \((5s|3s|5\/3\/1)\) — (.+)$/u.exec(dayName);
  if (fiveThreeOne?.[1] && fiveThreeOne[2] && fiveThreeOne[3]) {
    const localizedFocus = fiveThreeOne[3].split(' + ').map((focus) => localizeDayFocus(focus, t));
    if (localizedFocus.every((focus): focus is string => focus !== null)) {
      return t('program_content.days.week_scheme_focus', {
        week: fiveThreeOne[1],
        scheme: fiveThreeOne[2],
        focus: localizedFocus.join(' + '),
      });
    }
  }

  const deload = /^Descarga — (.+)$/u.exec(dayName);
  if (deload?.[1]) {
    const focus = localizeDayFocus(deload[1], t);
    if (focus !== null) {
      return t('program_content.days.deload_focus', { focus });
    }
  }

  const absoluteDay = /^Semana (\d+) - Dia (\d+) \((SQUAT|BENCH|DEADLIFT)\)$/u.exec(dayName);
  if (absoluteDay?.[1] && absoluteDay[2] && absoluteDay[3]) {
    const focus = localizeDayFocus(absoluteDay[3], t);
    if (focus !== null) {
      return t('program_content.days.week_absolute_day_focus', {
        week: absoluteDay[1],
        day: absoluteDay[2],
        focus,
      });
    }
  }

  const phaseDay =
    /^(FZ|T1|PN) Sem\. (\d+) — Dia (\d+)(?: \((Sentadilla|Banca|Banca\/Muerto|Peso Muerto|Ligero)\))?$/u.exec(
      dayName
    );
  if (phaseDay?.[1] && phaseDay[2] && phaseDay[3]) {
    if (phaseDay[4]) {
      const focus = localizeDayFocus(phaseDay[4], t);
      if (focus !== null) {
        return t('program_content.days.phase_week_day_focus', {
          phase: phaseDay[1],
          week: phaseDay[2],
          day: phaseDay[3],
          focus,
        });
      }
    } else {
      return t('program_content.days.phase_week_day', {
        phase: phaseDay[1],
        week: phaseDay[2],
        day: phaseDay[3],
      });
    }
  }

  const jawDay = /^(JAW(?: Mod)?) B([123]) Sem\. (\d+) — Dia ([1-4])(?: \(Ligero\))?$/u.exec(
    dayName
  );
  if (jawDay?.[1] && jawDay[2] && jawDay[3] && jawDay[4]) {
    const key = dayName.endsWith('(Ligero)') ? 'jaw_week_day_light' : 'jaw_week_day';
    return t(`program_content.days.${key}`, {
      variant: jawDay[1],
      block: jawDay[2],
      week: jawDay[3],
      day: jawDay[4],
    });
  }

  const jawMaxTest =
    /^(JAW(?: Mod)?) Bloque ([123]) — Test Maximo (Sentadilla|Press Banca|Peso Muerto)$/u.exec(
      dayName
    );
  if (jawMaxTest?.[1] && jawMaxTest[2] && jawMaxTest[3]) {
    const focus = localizeDayFocus(jawMaxTest[3], t);
    if (focus !== null) {
      return t('program_content.days.jaw_block_max_test', {
        variant: jawMaxTest[1],
        block: jawMaxTest[2],
        focus,
      });
    }
  }

  const jawRecovery = /^(JAW(?: Mod)?) Bloque ([123]) — Sem\. (\d+) Recuperacion$/u.exec(dayName);
  if (jawRecovery?.[1] && jawRecovery[2] && jawRecovery[3]) {
    return t('program_content.days.jaw_block_recovery', {
      variant: jawRecovery[1],
      block: jawRecovery[2],
      week: jawRecovery[3],
    });
  }

  const isolationDay =
    /^IS S([12]) Sem\. (\d+) — Dia ([1-4]) \((Sentadilla|Banca|Peso Muerto|Accesorios)\)$/u.exec(
      dayName
    );
  if (isolationDay?.[1] && isolationDay[2] && isolationDay[3] && isolationDay[4]) {
    const focus = localizeDayFocus(isolationDay[4], t);
    if (focus !== null) {
      return t('program_content.days.isolation_week_day_focus', {
        stage: isolationDay[1],
        week: isolationDay[2],
        day: isolationDay[3],
        focus,
      });
    }
  }

  const sheikoDay = /^Semana (\d+) — Dia ([1-4])$/u.exec(dayName);
  if (sheikoDay?.[1] && sheikoDay[2]) {
    return t('program_content.days.week_day', {
      week: sheikoDay[1],
      day: sheikoDay[2],
    });
  }

  return null;
}

export interface LocalizedCatalogEntry {
  readonly description: string;
  readonly level: string;
  readonly name: string;
}

export function localizeCatalogEntry(entry: CatalogEntry, t: TFunction): LocalizedCatalogEntry {
  const contentId = canonicalContentId(entry);
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
  origin: ProgramContentOrigin,
  dayName: string,
  t: TFunction
): string {
  if (canonicalContentId(origin) !== null) {
    const localized = localizeCanonicalDayName(dayName, t);
    if (localized === null) {
      throw new Error(`Missing canonical day localization for ${origin.id}`);
    }
    return localized;
  }
  return readExternalLabel(dayName, 'program_content.external.unnamed_day', t);
}

export function localizeExerciseName(
  origin: ProgramContentOrigin,
  exerciseId: string,
  canonicalName: string | undefined,
  t: TFunction
): string {
  if (canonicalContentId(origin) !== null) {
    return readRequiredTranslation(t, `program_content.exercises.${exerciseId}`);
  }
  return readExternalLabel(canonicalName, 'program_content.external.unnamed_exercise', t);
}

export function localizeFieldLabel(
  origin: ProgramContentOrigin,
  fieldKey: string,
  canonicalLabel: string,
  t: TFunction
): string {
  const contentId = canonicalContentId(origin);
  if (contentId !== null) {
    return readRequiredTranslation(t, `program_content.fields.catalog.${contentId}.${fieldKey}`);
  }
  return readExternalLabel(canonicalLabel, 'program_content.external.unnamed_field', t);
}

export function localizeSelectOption(
  origin: ProgramContentOrigin,
  fieldKey: string,
  value: string,
  canonicalLabel: string,
  t: TFunction,
  language: SupportedLanguage
): string {
  if (canonicalContentId(origin) !== null) {
    if (fieldKey === 'gender' && (value === 'male' || value === 'female')) {
      return readRequiredTranslation(t, `program_content.options.gender.${value}`);
    }
    if (fieldKey === 'rounding' && (value === '2.5' || value === '1.25')) {
      return readRequiredTranslation(
        t,
        `program_content.options.rounding.${
          value === '2.5' ? 'two_point_five' : 'one_point_two_five'
        }`
      );
    }
    throw new Error(`Missing canonical select-option localization for ${origin.id}`);
  }
  if (fieldKey === 'rounding') {
    const numeric = CANONICAL_POSITIVE_DECIMAL_PATTERN.test(value) ? Number(value) : null;
    if (numeric !== null && numeric > 0 && ProgramWeightValueSchema.safeParse(numeric).success) {
      return t('program_content.options.rounding.other', {
        value: formatLocalizedWeight(numeric, language),
      });
    }
  }
  return readExternalLabel(canonicalLabel, 'program_content.external.unnamed_option', t);
}

export function localizeTier(tier: string, t: TFunction): string {
  const key = readKnownKey(TIER_CONTENT_KEYS, tier.toLowerCase());
  return key === null ? t('program_content.tier.other') : t(`program_content.tier.${key}`);
}
