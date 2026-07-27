import { PROGRAM_CATALOG } from '@gzclp/domain/catalog';

import i18n from '../i18n';
import {
  localizeCatalogEntry,
  localizeExerciseName,
  localizeFieldLabel,
  localizeSelectOption,
} from './program-content';

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
    expect(
      localizeFieldLabel('hexan-ppl', 'squat_tm', 'Sentadilla (Training Max)', i18n.t, 'en')
    ).toBe('Squat · training max');
    expect(localizeExerciseName('lat_pulldown', undefined, i18n.t, 'en')).toBe('Lat pulldown');
    expect(
      localizeSelectOption(
        'gender',
        'male',
        'Hombre (objetivo: peso corporal en barra)',
        i18n.t,
        'en'
      )
    ).toBe('Male · target: 100% of bodyweight on the bar');
    expect(
      localizeSelectOption(
        'gender',
        'female',
        'Mujer (objetivo: 70% peso corporal en barra)',
        i18n.t,
        'en'
      )
    ).toBe('Female · target: 70% of bodyweight on the bar');
    expect(localizeSelectOption('rounding', '2.5', '2.5 kg', i18n.t, 'en')).toBe('2.5 kg');

    await i18n.changeLanguage('es');
    expect(
      localizeSelectOption(
        'gender',
        'male',
        'Hombre (objetivo: peso corporal en barra)',
        i18n.t,
        'es'
      )
    ).toContain('Hombre');
    expect(
      localizeSelectOption(
        'gender',
        'female',
        'Mujer (objetivo: 70% peso corporal en barra)',
        i18n.t,
        'es'
      )
    ).toContain('Mujer');
    expect(localizeSelectOption('rounding', '2.5', '2.5 kg', i18n.t, 'es')).toBe('2,5 kg');
    expect(localizeSelectOption('rounding', '1.25', '1.25 kg', i18n.t, 'es')).toBe('1,25 kg');
  });

  it('uses stable-key human labels for unknown future content', async () => {
    await i18n.changeLanguage('en');
    expect(localizeExerciseName('custom_cable_press', undefined, i18n.t, 'en')).toBe(
      'Custom Cable Press'
    );
    expect(localizeFieldLabel('custom-program', 'starting_load', '', i18n.t, 'en')).toBe(
      'Starting Load'
    );
  });
});
