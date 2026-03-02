import { describe, it, expect } from 'bun:test';
import { ExerciseSlotSchema } from './program-definition';

// ---------------------------------------------------------------------------
// Minimal valid slot fixture (all required fields present)
// ---------------------------------------------------------------------------

const VALID_SLOT_BASE = {
  id: 'test_slot',
  exerciseId: 'squat',
  tier: 'main',
  stages: [{ sets: 1, reps: 1 }],
  onSuccess: { type: 'no_change' },
  onMidStageFail: { type: 'no_change' },
  onFinalStageFail: { type: 'no_change' },
  startWeightKey: 'squat_tm',
} as const;

// ---------------------------------------------------------------------------
// ExerciseSlotSchema — propagatesTo and isTestSlot fields
// ---------------------------------------------------------------------------

describe('ExerciseSlotSchema', () => {
  describe('propagatesTo', () => {
    it('should parse a valid slot with propagatesTo and preserve the value', () => {
      const input = { ...VALID_SLOT_BASE, propagatesTo: 'squat_jaw_b2_tm' };

      const result = ExerciseSlotSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.propagatesTo).toBe('squat_jaw_b2_tm');
      }
    });

    it('should parse a slot without propagatesTo and set it to undefined', () => {
      const input = { ...VALID_SLOT_BASE };

      const result = ExerciseSlotSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.propagatesTo).toBeUndefined();
      }
    });

    it('should reject propagatesTo with an empty string (min length 1)', () => {
      const input = { ...VALID_SLOT_BASE, propagatesTo: '' };

      const result = ExerciseSlotSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe('isTestSlot', () => {
    it('should parse a valid slot with isTestSlot: true', () => {
      const input = { ...VALID_SLOT_BASE, isTestSlot: true };

      const result = ExerciseSlotSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isTestSlot).toBe(true);
      }
    });

    it('should parse a slot without isTestSlot and set it to undefined', () => {
      const input = { ...VALID_SLOT_BASE };

      const result = ExerciseSlotSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isTestSlot).toBeUndefined();
      }
    });

    it('should reject isTestSlot with a non-boolean value', () => {
      const input = { ...VALID_SLOT_BASE, isTestSlot: 'yes' };

      const result = ExerciseSlotSchema.safeParse(input);

      expect(result.success).toBe(false);
    });
  });

  describe('backward compatibility', () => {
    it('should parse an existing slot definition without propagatesTo or isTestSlot', () => {
      const input = { ...VALID_SLOT_BASE };

      const result = ExerciseSlotSchema.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.propagatesTo).toBeUndefined();
        expect(result.data.isTestSlot).toBeUndefined();
      }
    });
  });
});
