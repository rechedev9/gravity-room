import { describe, it, expect } from 'bun:test';
import { buildDefaultConfig } from './use-program-preview';
import type { ProgramDefinition } from '@gzclp/domain/types/program';

// ---------------------------------------------------------------------------
// Type alias for config fields (avoids verbose inline types)
// ---------------------------------------------------------------------------

type ConfigFields = ProgramDefinition['configFields'];

// ---------------------------------------------------------------------------
// buildDefaultConfig — unit tests (REQ-HOOK-002)
// ---------------------------------------------------------------------------

describe('buildDefaultConfig', () => {
  describe('weight fields', () => {
    it('should use min value when min > 0', () => {
      const fields: ConfigFields = [
        { key: 'squat', label: 'Sentadilla', type: 'weight', min: 20, step: 2.5 },
      ];

      const config = buildDefaultConfig(fields);

      expect(config['squat']).toBe(20);
    });

    it('should use step * 8 fallback when min is 0', () => {
      const fields: ConfigFields = [
        { key: 'bench', label: 'Press Banca', type: 'weight', min: 0, step: 2.5 },
      ];

      const config = buildDefaultConfig(fields);

      expect(config['bench']).toBe(20); // 2.5 * 8 = 20
    });

    it('should fallback to 20 when both min and step * 8 are 0', () => {
      const fields: ConfigFields = [
        { key: 'ohp', label: 'Press Militar', type: 'weight', min: 0, step: 0 },
      ];

      const config = buildDefaultConfig(fields);

      expect(config['ohp']).toBe(20);
    });
  });

  describe('select fields', () => {
    it('should use first option value', () => {
      const fields: ConfigFields = [
        {
          key: 'variant',
          label: 'Variante',
          type: 'select',
          options: [
            { label: 'A', value: 'alpha' },
            { label: 'B', value: 'beta' },
          ],
        },
      ];

      const config = buildDefaultConfig(fields);

      expect(config['variant']).toBe('alpha');
    });
  });

  describe('mixed config fields', () => {
    it('should populate all keys for a mixed set of weight and select fields', () => {
      const fields: ConfigFields = [
        { key: 'squat', label: 'Sentadilla', type: 'weight', min: 60, step: 2.5 },
        { key: 'bench', label: 'Press Banca', type: 'weight', min: 40, step: 2.5 },
        { key: 'deadlift', label: 'Peso Muerto', type: 'weight', min: 0, step: 5 },
        {
          key: 'variant',
          label: 'Variante',
          type: 'select',
          options: [
            { label: 'Standard', value: 'std' },
            { label: 'Alternativo', value: 'alt' },
          ],
        },
        { key: 'ohp', label: 'Press Militar', type: 'weight', min: 30, step: 1 },
      ];

      const config = buildDefaultConfig(fields);

      expect(Object.keys(config)).toHaveLength(5);
      expect(config['squat']).toBe(60);
      expect(config['bench']).toBe(40);
      expect(config['deadlift']).toBe(40); // 5 * 8 = 40
      expect(config['variant']).toBe('std');
      expect(config['ohp']).toBe(30);
    });
  });
});
