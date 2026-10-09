import i18n from '../../lib/i18n';
import { attributeKey, attributeLabel } from './exercise-labels';

describe('exercise labels', () => {
  it('folds API values into catalog keys', () => {
    expect(attributeKey('body only')).toBe('body_only');
    expect(attributeKey('E-Z Curl Bar')).toBe('e_z_curl_bar');
  });

  it('translates known values and shows unknown ones as sent', () => {
    expect(attributeLabel(i18n.t, 'equipment', 'body only')).toBe('Bodyweight');
    expect(attributeLabel(i18n.t, 'muscle', 'legs', 'Piernas')).toBe('Legs');
    expect(attributeLabel(i18n.t, 'muscle', 'neck', 'Cuello')).toBe('Cuello');
    expect(attributeLabel(i18n.t, 'equipment', 'sled')).toBe('sled');
  });
});
