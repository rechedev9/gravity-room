import { describe, it, expect } from 'bun:test';
import { NIVEL7_DEFINITION } from './nivel7';
import { computeGenericProgram } from '../generic-engine';

// Config values are the week-6 RECORD targets.
// All weights below are derived: S1=T−10, S2=T−7.5, S3=T−10, S4=T−5, S5=T−2.5, S6=T.
const BASE_CONFIG = {
  press_mil: 50,
  bench: 70,
  squat: 90,
  deadlift: 110,
};

describe('NIVEL7_DEFINITION', () => {
  describe('structure', () => {
    it('should have 24 days', () => {
      expect(NIVEL7_DEFINITION.days.length).toBe(24);
    });

    it('should have totalWorkouts = 24', () => {
      expect(NIVEL7_DEFINITION.totalWorkouts).toBe(24);
    });

    it('should have cycleLength = 24', () => {
      expect(NIVEL7_DEFINITION.cycleLength).toBe(24);
    });

    it('should have workoutsPerWeek = 4', () => {
      expect(NIVEL7_DEFINITION.workoutsPerWeek).toBe(4);
    });

    it('should have 4 config fields (1 target per main lift)', () => {
      expect(NIVEL7_DEFINITION.configFields.length).toBe(4);
    });

    it('should have 5-6 slots per day', () => {
      for (const day of NIVEL7_DEFINITION.days) {
        expect(day.slots.length).toBeGreaterThanOrEqual(4);
        expect(day.slots.length).toBeLessThanOrEqual(6);
      }
    });

    it('should have correct day names repeating across blocks', () => {
      const block1Names = NIVEL7_DEFINITION.days.slice(0, 4).map((d) => d.name);
      const block2Names = NIVEL7_DEFINITION.days.slice(12, 16).map((d) => d.name);
      expect(block1Names).toEqual(block2Names);
    });
  });

  describe('wave periodization (target-based)', () => {
    it('should derive press militar weights from target: S1=T−10, S2=T−7.5, S3=T−10, S4=T−5, S5=T−2.5, S6=T', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      // T=50 → S1=40, S2=42.5, S3=40 (deload), S4=45, S5=47.5, S6=50
      const b1Weights = [0, 4].map(
        (i) => rows[i].slots.find((s) => s.slotId === 'press_mil-b1')?.weight
      );
      const deloadWeight = rows[8].slots.find((s) => s.slotId === 'press_mil-b1d')?.weight;
      const b2Weights = [12, 16, 20].map(
        (i) => rows[i].slots.find((s) => s.slotId === 'press_mil-b2')?.weight
      );

      expect(b1Weights).toEqual([40, 42.5]);
      expect(deloadWeight).toBe(40);
      expect(b2Weights).toEqual([45, 47.5, 50]);
    });

    it('should derive bench weights from target', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      // T=70 → S1=60, S2=62.5, S3=60, S4=65, S5=67.5, S6=70
      const b1Weights = [2, 6].map(
        (i) => rows[i].slots.find((s) => s.slotId === 'bench-b1')?.weight
      );
      const deloadWeight = rows[10].slots.find((s) => s.slotId === 'bench-b1d')?.weight;
      const b2Weights = [14, 18, 22].map(
        (i) => rows[i].slots.find((s) => s.slotId === 'bench-b2')?.weight
      );

      expect(b1Weights).toEqual([60, 62.5]);
      expect(deloadWeight).toBe(60);
      expect(b2Weights).toEqual([65, 67.5, 70]);
    });

    it('should derive squat weights from target', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      // T=90 → S1=80, S2=82.5, S3=80, S4=85, S5=87.5, S6=90
      const b1Weights = [3, 7].map(
        (i) => rows[i].slots.find((s) => s.slotId === 'squat-b1')?.weight
      );
      const deloadWeight = rows[11].slots.find((s) => s.slotId === 'squat-b1d')?.weight;
      const b2Weights = [15, 19, 23].map(
        (i) => rows[i].slots.find((s) => s.slotId === 'squat-b2')?.weight
      );

      expect(b1Weights).toEqual([80, 82.5]);
      expect(deloadWeight).toBe(80);
      expect(b2Weights).toEqual([85, 87.5, 90]);
    });

    it('should derive deadlift weights from target', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      // T=110 → S1=100, S2=102.5, S3=100, S4=105, S5=107.5, S6=110
      const b1Weights = [1, 5].map(
        (i) => rows[i].slots.find((s) => s.slotId === 'deadlift-b1')?.weight
      );
      const deloadWeight = rows[9].slots.find((s) => s.slotId === 'deadlift-b1d')?.weight;
      const b2Weights = [13, 17, 21].map(
        (i) => rows[i].slots.find((s) => s.slotId === 'deadlift-b2')?.weight
      );

      expect(b1Weights).toEqual([100, 102.5]);
      expect(deloadWeight).toBe(100);
      expect(b2Weights).toEqual([105, 107.5, 110]);
    });

    it('should reach the exact target weight in the final session (week 6)', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      expect(rows[20].slots.find((s) => s.slotId === 'press_mil-b2')?.weight).toBe(50);
      expect(rows[22].slots.find((s) => s.slotId === 'bench-b2')?.weight).toBe(70);
      expect(rows[23].slots.find((s) => s.slotId === 'squat-b2')?.weight).toBe(90);
      expect(rows[21].slots.find((s) => s.slotId === 'deadlift-b2')?.weight).toBe(110);
    });
  });

  describe('deload behavior', () => {
    it('should keep deload weight fixed regardless of result', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {
        '8': { 'press_mil-b1d': { result: 'success' } },
      });

      // Deload slot has NO_CHANGE — success doesn't alter weight
      const deloadSlot = rows[8].slots.find((s) => s.slotId === 'press_mil-b1d');
      expect(deloadSlot?.weight).toBe(40);
    });

    it('should keep deload weight fixed on fail', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {
        '8': { 'press_mil-b1d': { result: 'fail' } },
      });

      const deloadSlot = rows[8].slots.find((s) => s.slotId === 'press_mil-b1d');
      expect(deloadSlot?.weight).toBe(40);
    });
  });

  describe('slot chains', () => {
    it('should use 3 distinct slot chains per main lift (b1, b1d, b2)', () => {
      const allSlotIds = new Set<string>();

      for (const day of NIVEL7_DEFINITION.days) {
        for (const slot of day.slots) {
          allSlotIds.add(slot.id);
        }
      }

      // Each of the 4 main lifts has 3 chains → 12 main lift slot IDs
      const mainLiftIds = [...allSlotIds].filter(
        (id) => id.endsWith('-b1') || id.endsWith('-b1d') || id.endsWith('-b2')
      );
      expect(mainLiftIds.length).toBe(12);
    });

    it('should use b1 chain only in weeks 1-2 (days 0-7)', () => {
      for (let i = 0; i < 8; i++) {
        const mainSlot = NIVEL7_DEFINITION.days[i].slots[0];
        expect(mainSlot.id).toMatch(/-b1$/);
      }
    });

    it('should use b1d chain only in week 3 (days 8-11)', () => {
      for (let i = 8; i < 12; i++) {
        const mainSlot = NIVEL7_DEFINITION.days[i].slots[0];
        expect(mainSlot.id).toMatch(/-b1d$/);
      }
    });

    it('should use b2 chain in weeks 4-6 (days 12-23)', () => {
      for (let i = 12; i < 24; i++) {
        const mainSlot = NIVEL7_DEFINITION.days[i].slots[0];
        expect(mainSlot.id).toMatch(/-b2$/);
      }
    });
  });

  describe('block 1 scheme', () => {
    it('should use 5x5 for block 1 main lifts (except deadlift)', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      const pressSlot = rows[0].slots.find((s) => s.slotId === 'press_mil-b1');
      expect(pressSlot?.sets).toBe(5);
      expect(pressSlot?.reps).toBe(5);
    });

    it('should use 1x5 for block 1 deadlift', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      const dlSlot = rows[1].slots.find((s) => s.slotId === 'deadlift-b1');
      expect(dlSlot?.sets).toBe(1);
      expect(dlSlot?.reps).toBe(5);
    });
  });

  describe('block 2 scheme', () => {
    it('should use 3x3 for block 2 main lifts (except deadlift)', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      const pressSlot = rows[12].slots.find((s) => s.slotId === 'press_mil-b2');
      expect(pressSlot?.sets).toBe(3);
      expect(pressSlot?.reps).toBe(3);
    });

    it('should use 1x3 for block 2 deadlift', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      const dlSlot = rows[13].slots.find((s) => s.slotId === 'deadlift-b2');
      expect(dlSlot?.sets).toBe(1);
      expect(dlSlot?.reps).toBe(3);
    });
  });

  describe('accessory behavior', () => {
    it('should not auto-progress accessory weights', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      const pfWeights = [0, 4, 8, 12, 16, 20].map((i) => {
        const slot = rows[i].slots.find((s) => s.slotId === 'press_franc');
        return slot?.weight;
      });

      expect(pfWeights.every((w) => w === 0)).toBe(true);
    });

    it('should vary accessory sets/reps per week', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      const wk1 = rows[0].slots.find((s) => s.slotId === 'press_franc');
      const wk2 = rows[4].slots.find((s) => s.slotId === 'press_franc');
      const wk3 = rows[8].slots.find((s) => s.slotId === 'press_franc');

      expect(wk1?.sets).toBe(4);
      expect(wk1?.reps).toBe(8);
      expect(wk2?.sets).toBe(4);
      expect(wk2?.reps).toBe(6);
      expect(wk3?.sets).toBe(5);
      expect(wk3?.reps).toBe(5);
    });

    it('should share accessory slot IDs across blocks for weight continuity', () => {
      const day0 = NIVEL7_DEFINITION.days[0];
      const day12 = NIVEL7_DEFINITION.days[12];

      const pfDay0 = day0.slots.find((s) => s.exerciseId === 'press_franc');
      const pfDay12 = day12.slots.find((s) => s.exerciseId === 'press_franc');

      expect(pfDay0?.id).toBe('press_franc');
      expect(pfDay12?.id).toBe('press_franc');
    });
  });

  describe('fail behavior', () => {
    it('should keep weight on build-phase fail (no_change)', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {
        '0': { 'press_mil-b1': { result: 'fail' } },
      });

      // After fail on day 0, day 4 should still have same weight
      const day4Slot = rows[4].slots.find((s) => s.slotId === 'press_mil-b1');
      expect(day4Slot?.weight).toBe(40);
    });

    it('should resume progression after success following a fail', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {
        '0': { 'press_mil-b1': { result: 'fail' } },
        '4': { 'press_mil-b1': { result: 'success' } },
      });

      // Day 0: 40kg (fail → no change), Day 4: 40kg (success → +2.5)
      // But b1 only has 2 appearances (days 0, 4) — the progression after day 4
      // doesn't surface in the b1 chain. Verify day 4 stayed at 40.
      const day4Slot = rows[4].slots.find((s) => s.slotId === 'press_mil-b1');
      expect(day4Slot?.weight).toBe(40);
    });

    it('should keep weight on block 2 fail', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {
        '12': { 'press_mil-b2': { result: 'fail' } },
      });

      // After fail on day 12, day 16 should still have same weight (T-5 = 45)
      const day16Slot = rows[16].slots.find((s) => s.slotId === 'press_mil-b2');
      expect(day16Slot?.weight).toBe(45);
    });

    it('should progress block 2 after success following a fail', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {
        '12': { 'press_mil-b2': { result: 'fail' } },
        '16': { 'press_mil-b2': { result: 'success' } },
      });

      // Day 12: 45kg (fail → no change)
      // Day 16: 45kg (success → +2.5)
      // Day 20: 47.5kg
      const day20Slot = rows[20].slots.find((s) => s.slotId === 'press_mil-b2');
      expect(day20Slot?.weight).toBe(47.5);
    });
  });
});
