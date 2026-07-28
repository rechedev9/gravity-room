import { PROGRAM_CATALOG } from '@gzclp/domain/catalog';

import i18n from '../i18n';
import {
  localizeCatalogEntry,
  localizeDayName,
  localizeExerciseName,
  localizeFieldLabel,
  localizeSelectOption,
  localizeTier,
} from './program-content';

const HEXAN = { id: 'hexan-ppl', source: 'preset' };
const TURTLE = { id: 'caparazon-de-tortuga', source: 'preset' };
const CUSTOM = { id: 'custom-program', source: 'custom' };

describe('localized canonical program content', () => {
  it.each(['en', 'es'] as const)(
    'has complete %s catalog metadata with no raw-description fallback',
    async (language) => {
      await i18n.changeLanguage(language);

      for (const program of PROGRAM_CATALOG) {
        const localized = localizeCatalogEntry(
          {
            ...program,
            source: 'preset',
            totalWorkouts: 1,
            workoutsPerWeek: 1,
            cycleLength: 1,
          },
          i18n.t
        );
        expect(i18n.exists(`program_content.catalog.${program.id}.name`, { lng: language })).toBe(
          true
        );
        expect(
          i18n.exists(`program_content.catalog.${program.id}.description`, { lng: language })
        ).toBe(true);
        expect(localized.name).not.toBe('');
        expect(localized.description).not.toBe(program.description);
      }
    }
  );

  it('keeps HeXaN and Turtle Shell semantics explicit in both locales', async () => {
    await i18n.changeLanguage('en');
    expect(localizeFieldLabel(HEXAN, 'squat_tm', 'Sentadilla (Training Max)', i18n.t)).toBe(
      'Squat · training max'
    );
    expect(localizeExerciseName(HEXAN, 'lat_pulldown', undefined, i18n.t)).toBe('Lat pulldown');
    expect(
      localizeSelectOption(
        TURTLE,
        'gender',
        'male',
        'Hombre (objetivo: peso corporal en barra)',
        i18n.t,
        'en'
      )
    ).toBe('Male · target: 100% of bodyweight on the bar');
    expect(
      localizeSelectOption(
        TURTLE,
        'gender',
        'female',
        'Mujer (objetivo: 70% peso corporal en barra)',
        i18n.t,
        'en'
      )
    ).toBe('Female · target: 70% of bodyweight on the bar');
    expect(localizeSelectOption(TURTLE, 'rounding', '2.5', '2.5 kg', i18n.t, 'en')).toBe('2.5 kg');

    await i18n.changeLanguage('es');
    expect(
      localizeSelectOption(
        TURTLE,
        'gender',
        'male',
        'Hombre (objetivo: peso corporal en barra)',
        i18n.t,
        'es'
      )
    ).toContain('Hombre');
    expect(
      localizeSelectOption(
        TURTLE,
        'gender',
        'female',
        'Mujer (objetivo: 70% peso corporal en barra)',
        i18n.t,
        'es'
      )
    ).toContain('Mujer');
    expect(localizeSelectOption(TURTLE, 'rounding', '2.5', '2.5 kg', i18n.t, 'es')).toBe('2,5 kg');
    expect(localizeSelectOption(TURTLE, 'rounding', '1.25', '1.25 kg', i18n.t, 'es')).toBe(
      '1,25 kg'
    );
    expect(localizeSelectOption(CUSTOM, 'rounding', '0.5', '0.5 kg', i18n.t, 'es')).toBe('0,5 kg');
  });

  it('keeps external fallbacks human-safe and separate from the canonical catalog', async () => {
    await i18n.changeLanguage('en');
    expect(localizeExerciseName(CUSTOM, 'custom_cable_press', undefined, i18n.t)).toBe(
      'Unnamed custom exercise'
    );
    expect(localizeExerciseName(CUSTOM, 'custom_cable_press', 'custom_cable_press', i18n.t)).toBe(
      'Unnamed custom exercise'
    );
    expect(localizeExerciseName(CUSTOM, 'custom_cable_press', 'Cable press', i18n.t)).toBe(
      'Cable press'
    );
    expect(localizeExerciseName(CUSTOM, 'abs', 'Hollow-body hold', i18n.t)).toBe(
      'Hollow-body hold'
    );
    expect(localizeExerciseName(CUSTOM, 'push-up', 'push-up', i18n.t)).toBe('push-up');
    expect(localizeSelectOption(CUSTOM, 'gender', 'male', 'Men', i18n.t, 'en')).toBe('Men');
    expect(localizeFieldLabel(CUSTOM, 'starting_load', '', i18n.t)).toBe('Unnamed setup field');
    expect(localizeFieldLabel(CUSTOM, 'starting_load', 'Starting load', i18n.t)).toBe(
      'Starting load'
    );
    expect(localizeSelectOption(CUSTOM, 'custom', 'internal_value', '', i18n.t, 'en')).toBe(
      'Unnamed option'
    );
  });

  it('preserves every external layer when a custom definition collides with a preset ID', async () => {
    await i18n.changeLanguage('en');
    const collision = { id: 'gzclp', source: 'custom' };

    expect(
      localizeCatalogEntry(
        {
          id: collision.id,
          source: collision.source,
          name: 'Private progression',
          description: 'Private description',
          author: 'Owner',
          category: 'custom',
          level: 'intermediate',
          totalWorkouts: 1,
          workoutsPerWeek: 1,
          cycleLength: 1,
        },
        i18n.t
      )
    ).toMatchObject({
      name: 'Private progression',
      description: 'Private description',
    });
    expect(localizeDayName(collision, 'My private day', i18n.t)).toBe('My private day');
    expect(localizeExerciseName(collision, 'private', 'My private lift', i18n.t)).toBe(
      'My private lift'
    );
    expect(localizeFieldLabel(collision, 'private', 'My starting load', i18n.t)).toBe(
      'My starting load'
    );
    expect(localizeSelectOption(collision, 'gender', 'male', 'My option', i18n.t, 'en')).toBe(
      'My option'
    );
    expect(localizeTier(collision, 't1', i18n.t)).toBe('t1');
    expect(localizeTier(collision, 'main', i18n.t)).toBe('main');
    expect(localizeTier(collision, 'My private tier', i18n.t)).toBe('My private tier');
  });

  it.each([
    ['', 'Empty label'],
    [' ', 'Space label'],
    ['1e2', 'Exponent label'],
    ['0x10', 'Hex label'],
    ['0,5', 'Comma label'],
    ['+0.5', 'Signed label'],
    ['-0.5', 'Negative label'],
    ['00.5', 'Leading-zero label'],
    ['0.0000001', 'Too-small label'],
    ['1000000000000000000000', 'Too-large label'],
  ])(
    'keeps external rounding label %s outside the canonical decimal grammar',
    async (value, label) => {
      await i18n.changeLanguage('en');
      expect(localizeSelectOption(CUSTOM, 'rounding', value, label, i18n.t, 'en')).toBe(label);
    }
  );
});
