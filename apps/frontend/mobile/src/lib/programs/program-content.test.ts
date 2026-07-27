import { PROGRAM_CATALOG } from '@gzclp/domain/catalog';

import i18n from '../i18n';
import { localizeCatalogEntry } from './program-content';

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
});
