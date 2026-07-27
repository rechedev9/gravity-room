import fs from 'node:fs';
import path from 'node:path';

import { PROGRAM_CATALOG } from '@gzclp/domain/catalog';
import { PROGRAM_DEFINITION_SEEDS } from '../../../../../../packages/database/src/seeds/program-templates-seed';

import en from '../i18n/locales/en/translation.json';
import es from '../i18n/locales/es/translation.json';
import i18n from '../i18n';
import {
  localizeCatalogEntry,
  localizeDayName,
  localizeExerciseName,
  localizeFieldLabel,
  localizeSelectOption,
  localizeTier,
} from './program-content';
import { CATALOG_COPY_ORACLE, TIER_COPY_ORACLE } from './program-content-catalog.oracle';

function presetOrigin(id) {
  return { id, source: 'preset' };
}

const EXTERNAL_ORIGIN = { id: 'external-program', source: 'custom' };

const RESOURCES_BY_LANGUAGE = {
  en: en.program_content,
  es: es.program_content,
};

const SIMPLE_DAYS = {
  en: {
    'Día 1': 'Day 1',
    'Día 2': 'Day 2',
    'Día 3': 'Day 3',
    'Día 4': 'Day 4',
    'Workout A': 'Workout A',
    'Workout B': 'Workout B',
    'Pull A': 'Pull A',
    'Pull B': 'Pull B',
    'Push A': 'Push A',
    'Push B': 'Push B',
    'Legs A': 'Legs A',
    'Legs B': 'Legs B',
    'Fuerza Superior': 'Upper-body power',
    'Fuerza Inferior': 'Lower-body power',
    'Hipertrofia Superior': 'Upper-body hypertrophy',
    'Hipertrofia Inferior': 'Lower-body hypertrophy',
    'Lun — Hombros/Tríceps': 'Mon — Shoulders/Triceps',
    'Mar — Espalda/Gemelo': 'Tue — Back/Calves',
    'Jue — Pecho/Bíceps': 'Thu — Chest/Biceps',
    'Vie — Pierna': 'Fri — Legs',
  },
  es: {
    'Día 1': 'Día 1',
    'Día 2': 'Día 2',
    'Día 3': 'Día 3',
    'Día 4': 'Día 4',
    'Workout A': 'Entrenamiento A',
    'Workout B': 'Entrenamiento B',
    'Pull A': 'Tirón A',
    'Pull B': 'Tirón B',
    'Push A': 'Empuje A',
    'Push B': 'Empuje B',
    'Legs A': 'Piernas A',
    'Legs B': 'Piernas B',
    'Fuerza Superior': 'Fuerza de tren superior',
    'Fuerza Inferior': 'Fuerza de tren inferior',
    'Hipertrofia Superior': 'Hipertrofia de tren superior',
    'Hipertrofia Inferior': 'Hipertrofia de tren inferior',
    'Lun — Hombros/Tríceps': 'Lun — Hombros/Tríceps',
    'Mar — Espalda/Gemelo': 'Mar — Espalda/Gemelos',
    'Jue — Pecho/Bíceps': 'Jue — Pecho/Bíceps',
    'Vie — Pierna': 'Vie — Piernas',
  },
};

const DAY_FOCUS = {
  en: {
    Accesorios: 'Accessories',
    Banca: 'Bench press',
    'Banca/Muerto': 'Bench press/Deadlift',
    BENCH: 'Bench press',
    DEADLIFT: 'Deadlift',
    Ligero: 'Light',
    'Peso Muerto': 'Deadlift',
    'Press Banca': 'Bench press',
    'Press Militar': 'Overhead press',
    Sentadilla: 'Squat',
    SQUAT: 'Squat',
  },
  es: {
    Accesorios: 'Accesorios',
    Banca: 'Press banca',
    'Banca/Muerto': 'Press banca/Peso muerto',
    BENCH: 'Press banca',
    DEADLIFT: 'Peso muerto',
    Ligero: 'Ligero',
    'Peso Muerto': 'Peso muerto',
    'Press Banca': 'Press banca',
    'Press Militar': 'Press militar',
    Sentadilla: 'Sentadilla',
    SQUAT: 'Sentadilla',
  },
};

const OPTION_EXPECTATIONS = {
  en: {
    'gender:male': 'Male · target: 100% of bodyweight on the bar',
    'gender:female': 'Female · target: 70% of bodyweight on the bar',
    'rounding:2.5': '2.5 kg',
    'rounding:1.25': '1.25 kg',
  },
  es: {
    'gender:male': 'Hombre · objetivo: el 100 % del peso corporal en la barra',
    'gender:female': 'Mujer · objetivo: el 70 % del peso corporal en la barra',
    'rounding:2.5': '2,5 kg',
    'rounding:1.25': '1,25 kg',
  },
};

const MIXED_LANGUAGE = {
  en: /\b(?:Semana|D[ií]a|Sentadilla|Banca|Peso Muerto|Ligero|Bloque|Recuperacion|Hombros|Espalda|Gemelos?|Pecho|Piernas?)\b/iu,
  es: /\b(?:Week|Day|Squat|Bench press|Deadlift|Light|Block|Recovery|Workout|Push|Legs|Upper-body|Lower-body|Max test)\b/iu,
};

function requiredFocus(language, canonicalFocus) {
  const localized = DAY_FOCUS[language][canonicalFocus];
  if (localized === undefined) {
    throw new Error(`Missing test expectation for day focus: ${canonicalFocus}`);
  }
  return localized;
}

function expectedDayName(language, canonicalName) {
  const simple = SIMPLE_DAYS[language][canonicalName];
  if (simple !== undefined) return simple;

  const fiveThreeOne = /^Sem\. (\d+) \((5s|3s|5\/3\/1)\) — (.+)$/u.exec(canonicalName);
  if (fiveThreeOne?.[1] && fiveThreeOne[2] && fiveThreeOne[3]) {
    const focus = fiveThreeOne[3]
      .split(' + ')
      .map((part) => requiredFocus(language, part))
      .join(' + ');
    return language === 'en'
      ? `Week ${fiveThreeOne[1]} (${fiveThreeOne[2]}) — ${focus}`
      : `Semana ${fiveThreeOne[1]} (${fiveThreeOne[2]}) — ${focus}`;
  }

  const deload = /^Descarga — (.+)$/u.exec(canonicalName);
  if (deload?.[1]) {
    const focus = requiredFocus(language, deload[1]);
    return language === 'en' ? `Deload — ${focus}` : `Descarga — ${focus}`;
  }

  const absoluteDay = /^Semana (\d+) - Dia (\d+) \((SQUAT|BENCH|DEADLIFT)\)$/u.exec(canonicalName);
  if (absoluteDay?.[1] && absoluteDay[2] && absoluteDay[3]) {
    const focus = requiredFocus(language, absoluteDay[3]);
    return language === 'en'
      ? `Week ${absoluteDay[1]} — Day ${absoluteDay[2]} (${focus})`
      : `Semana ${absoluteDay[1]} — Día ${absoluteDay[2]} (${focus})`;
  }

  const phaseDay =
    /^(FZ|T1|PN) Sem\. (\d+) — Dia (\d+)(?: \((Sentadilla|Banca|Banca\/Muerto|Peso Muerto|Ligero)\))?$/u.exec(
      canonicalName
    );
  if (phaseDay?.[1] && phaseDay[2] && phaseDay[3]) {
    const prefix =
      language === 'en'
        ? `${phaseDay[1]} · Week ${phaseDay[2]} — Day ${phaseDay[3]}`
        : `${phaseDay[1]} · Semana ${phaseDay[2]} — Día ${phaseDay[3]}`;
    return phaseDay[4] ? `${prefix} (${requiredFocus(language, phaseDay[4])})` : prefix;
  }

  const jawDay = /^(JAW(?: Mod)?) B([123]) Sem\. (\d+) — Dia ([1-4])(?: \(Ligero\))?$/u.exec(
    canonicalName
  );
  if (jawDay?.[1] && jawDay[2] && jawDay[3] && jawDay[4]) {
    const prefix =
      language === 'en'
        ? `${jawDay[1]} B${jawDay[2]} · Week ${jawDay[3]} — Day ${jawDay[4]}`
        : `${jawDay[1]} B${jawDay[2]} · Semana ${jawDay[3]} — Día ${jawDay[4]}`;
    if (!canonicalName.endsWith('(Ligero)')) return prefix;
    return `${prefix} (${language === 'en' ? 'Light' : 'Ligero'})`;
  }

  const jawMax =
    /^(JAW(?: Mod)?) Bloque ([123]) — Test Maximo (Sentadilla|Press Banca|Peso Muerto)$/u.exec(
      canonicalName
    );
  if (jawMax?.[1] && jawMax[2] && jawMax[3]) {
    const focus = requiredFocus(language, jawMax[3]);
    return language === 'en'
      ? `${jawMax[1]} Block ${jawMax[2]} — ${focus} max test`
      : `${jawMax[1]} Bloque ${jawMax[2]} — Test máximo de ${focus}`;
  }

  const jawRecovery = /^(JAW(?: Mod)?) Bloque ([123]) — Sem\. (\d+) Recuperacion$/u.exec(
    canonicalName
  );
  if (jawRecovery?.[1] && jawRecovery[2] && jawRecovery[3]) {
    return language === 'en'
      ? `${jawRecovery[1]} Block ${jawRecovery[2]} — Week ${jawRecovery[3]} recovery`
      : `${jawRecovery[1]} Bloque ${jawRecovery[2]} — Recuperación de la semana ${jawRecovery[3]}`;
  }

  const isolation =
    /^IS S([12]) Sem\. (\d+) — Dia ([1-4]) \((Sentadilla|Banca|Peso Muerto|Accesorios)\)$/u.exec(
      canonicalName
    );
  if (isolation?.[1] && isolation[2] && isolation[3] && isolation[4]) {
    const focus = requiredFocus(language, isolation[4]);
    return language === 'en'
      ? `IS S${isolation[1]} · Week ${isolation[2]} — Day ${isolation[3]} (${focus})`
      : `IS S${isolation[1]} · Semana ${isolation[2]} — Día ${isolation[3]} (${focus})`;
  }

  const sheiko = /^Semana (\d+) — Dia ([1-4])$/u.exec(canonicalName);
  if (sheiko?.[1] && sheiko[2]) {
    return language === 'en'
      ? `Week ${sheiko[1]} — Day ${sheiko[2]}`
      : `Semana ${sheiko[1]} — Día ${sheiko[2]}`;
  }

  throw new Error(`Missing exact test expectation for canonical day: ${canonicalName}`);
}

function expectLocalizedCopy(language, value) {
  expect(value.trim().length).toBeGreaterThan(0);
  expect(value).not.toMatch(MIXED_LANGUAGE[language]);
}

describe('real canonical program-content coverage', () => {
  it.each(['en', 'es'])(
    'matches exact stable-key expectations for every real %s seed',
    async (language) => {
      await i18n.changeLanguage(language);
      const resources = RESOURCES_BY_LANGUAGE[language];
      const seedIds = Object.keys(PROGRAM_DEFINITION_SEEDS).sort();
      expect(seedIds).toEqual(PROGRAM_CATALOG.map((program) => program.id).sort());
      expect(Object.keys(resources.fields.catalog).sort()).toEqual(seedIds);
      expect(Object.keys(CATALOG_COPY_ORACLE[language]).sort()).toEqual(seedIds);

      const expectedExerciseIds = new Set();
      const localizedExerciseLabels = {};
      const localizedBySeed = {};
      for (const program of PROGRAM_CATALOG) {
        const definition = PROGRAM_DEFINITION_SEEDS[program.id];
        expect(definition).toEqual(
          expect.objectContaining({
            configFields: expect.any(Array),
            days: expect.any(Array),
          })
        );
        expect(
          localizeCatalogEntry(
            {
              ...program,
              source: 'preset',
              totalWorkouts: definition.totalWorkouts,
              workoutsPerWeek: definition.workoutsPerWeek,
              cycleLength: definition.cycleLength,
            },
            i18n.t
          )
        ).toMatchObject(CATALOG_COPY_ORACLE[language][program.id]);

        expect(Object.keys(resources.fields.catalog[program.id]).sort()).toEqual(
          definition.configFields.map((field) => field.key).sort()
        );

        const seedExerciseIds = new Set();
        const localizedFields = {};
        const localizedOptions = {};
        for (const day of definition.days) {
          const localizedDay = localizeDayName(presetOrigin(program.id), day.name, i18n.t);
          expect(localizedDay).toBe(expectedDayName(language, day.name));
          expectLocalizedCopy(language, localizedDay);

          for (const slot of day.slots) {
            expectedExerciseIds.add(slot.exerciseId);
            seedExerciseIds.add(slot.exerciseId);
            expect(
              i18n.exists(`program_content.exercises.${slot.exerciseId}`, { lng: language })
            ).toBe(true);
            const localizedExercise = localizeExerciseName(
              presetOrigin(program.id),
              slot.exerciseId,
              undefined,
              i18n.t
            );
            expect(localizedExercise).not.toBe(slot.exerciseId);
            expectLocalizedCopy(language, localizedExercise);
            localizedExerciseLabels[slot.exerciseId] = localizedExercise;
          }
        }

        for (const field of definition.configFields) {
          expect(
            i18n.exists(`program_content.fields.catalog.${program.id}.${field.key}`, {
              lng: language,
            })
          ).toBe(true);
          const localizedField = localizeFieldLabel(
            presetOrigin(program.id),
            field.key,
            field.label,
            i18n.t
          );
          expect(localizedField).not.toBe(field.key);
          expectLocalizedCopy(language, localizedField);
          localizedFields[field.key] = localizedField;

          if (field.type === 'select') {
            for (const option of field.options) {
              const optionKey = `${field.key}:${option.value}`;
              const localizedOption = localizeSelectOption(
                presetOrigin(program.id),
                field.key,
                option.value,
                option.label,
                i18n.t,
                language
              );
              expect(localizedOption).toBe(OPTION_EXPECTATIONS[language][optionKey]);
              expect(localizedOption).not.toBe(option.value);
              expectLocalizedCopy(language, localizedOption);
              localizedOptions[optionKey] = localizedOption;
            }
          }
        }

        localizedBySeed[program.id] = {
          exerciseIds: [...seedExerciseIds].sort(),
          fields: localizedFields,
          options: localizedOptions,
        };
      }

      expect(Object.keys(resources.exercises).sort()).toEqual([...expectedExerciseIds].sort());
      expect({
        exerciseLabels: localizedExerciseLabels,
        seeds: localizedBySeed,
      }).toMatchSnapshot();

      for (const [tier, expected] of Object.entries(TIER_COPY_ORACLE[language])) {
        expect(localizeTier(tier, i18n.t)).toBe(expected);
      }
    }
  );

  it('rejects a coordinated Banana catalog mutation in both locales', async () => {
    const program = PROGRAM_CATALOG.find((entry) => entry.id === 'gzclp');
    const definition = PROGRAM_DEFINITION_SEEDS.gzclp;
    if (program === undefined || definition === undefined) {
      throw new Error('GZCLP oracle fixture is missing');
    }

    for (const language of ['en', 'es']) {
      await i18n.changeLanguage(language);
      const bananaTranslator = (key, options) =>
        key === 'program_content.catalog.gzclp.name' ? 'Banana' : i18n.t(key, options);
      const mutated = localizeCatalogEntry(
        {
          ...program,
          source: 'preset',
          totalWorkouts: definition.totalWorkouts,
          workoutsPerWeek: definition.workoutsPerWeek,
          cycleLength: definition.cycleLength,
        },
        bananaTranslator
      );

      expect(() => expect(mutated).toMatchObject(CATALOG_COPY_ORACLE[language].gzclp)).toThrow();
    }
  });

  it('pins reproduced semantic regressions and safe non-ordinal external fallbacks', async () => {
    await i18n.changeLanguage('en');
    expect(localizeExerciseName(presetOrigin('phul'), 'apert', undefined, i18n.t)).toBe(
      'Dumbbell fly'
    );
    expect(localizeExerciseName(presetOrigin('phul'), 'curl_fem', undefined, i18n.t)).toBe(
      'Leg curl'
    );
    expect(localizeExerciseName(presetOrigin('nivel-7'), 'gemelo_pie', undefined, i18n.t)).toBe(
      'Standing calf raise'
    );
    expect(
      localizeExerciseName(presetOrigin('caparazon-de-tortuga'), 'bench_pushups', undefined, i18n.t)
    ).toBe('Bench-supported push-up');
    expect(
      localizeFieldLabel(
        presetOrigin('sala-del-tiempo-1'),
        'acc_incline_db_press',
        'Press Inclinado Mancuernas',
        i18n.t
      )
    ).toBe('Incline dumbbell press');
    expect(localizeDayName(presetOrigin('nivel-7'), 'Jue — Pecho/Bíceps', i18n.t)).toBe(
      'Thu — Chest/Biceps'
    );
    expect(
      localizeDayName(
        presetOrigin('365-programmare-lipertrofia'),
        'FZ Sem. 1 — Dia 2 (Banca/Muerto)',
        i18n.t
      )
    ).toBe('FZ · Week 1 — Day 2 (Bench press/Deadlift)');
    expect(localizeDayName(EXTERNAL_ORIGIN, '', i18n.t)).toBe('Unnamed training day');
    expect(localizeDayName(EXTERNAL_ORIGIN, 'private_day_id', i18n.t)).toBe('Unnamed training day');
    expect(localizeExerciseName(EXTERNAL_ORIGIN, 'private_exercise_id', undefined, i18n.t)).toBe(
      'Unnamed custom exercise'
    );
    expect(localizeFieldLabel(EXTERNAL_ORIGIN, 'private_field_id', '', i18n.t)).toBe(
      'Unnamed setup field'
    );
    expect(
      localizeSelectOption(EXTERNAL_ORIGIN, 'external', 'private_option_id', '', i18n.t, 'en')
    ).toBe('Unnamed option');

    const source = fs.readFileSync(path.join(__dirname, 'program-content.ts'), 'utf8');
    expect(source).not.toContain('humanizeIdentifier');
    expect(source).not.toContain('program_content.fallback');
    expect(source).not.toMatch(/\.replace(All)?\(/u);
  });
});
