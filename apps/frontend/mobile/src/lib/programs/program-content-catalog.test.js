import { PROGRAM_CATALOG } from '@gzclp/domain/catalog';
import { PROGRAM_DEFINITION_SEEDS } from '../../../../../../packages/database/src/seeds/program-templates-seed';

import i18n from '../i18n';
import {
  localizeDayName,
  localizeExerciseName,
  localizeFieldLabel,
  localizeSelectOption,
} from './program-content';

const OPAQUE_ORDINAL = /(?:Exercise|Ejercicio|Option|Opción|Starting value|Valor inicial)\s+\d+/iu;

function expectSemanticLabel(value) {
  expect(value.trim().length).toBeGreaterThan(0);
  expect(value).not.toMatch(OPAQUE_ORDINAL);
}

describe('real canonical program-content coverage', () => {
  it.each(['en', 'es'])(
    'localizes every real %s field, day, exercise and option without ordinal fallback',
    async (language) => {
      await i18n.changeLanguage(language);
      expect(Object.keys(PROGRAM_DEFINITION_SEEDS).sort()).toEqual(
        PROGRAM_CATALOG.map((program) => program.id).sort()
      );

      for (const program of PROGRAM_CATALOG) {
        const definition = PROGRAM_DEFINITION_SEEDS[program.id];
        expect(definition).toEqual(
          expect.objectContaining({
            configFields: expect.any(Array),
            days: expect.any(Array),
          })
        );

        for (const [dayIndex, day] of definition.days.entries()) {
          expectSemanticLabel(localizeDayName(program.id, day.name, dayIndex, i18n.t, language));
          for (const slot of day.slots) {
            expectSemanticLabel(localizeExerciseName(slot.exerciseId, undefined, i18n.t, language));
          }
        }

        for (const field of definition.configFields) {
          expectSemanticLabel(
            localizeFieldLabel(program.id, field.key, field.label, i18n.t, language)
          );
          if (field.type === 'select') {
            for (const option of field.options) {
              expectSemanticLabel(
                localizeSelectOption(field.key, option.value, option.label, i18n.t, language)
              );
            }
          }
        }
      }
    }
  );
});
