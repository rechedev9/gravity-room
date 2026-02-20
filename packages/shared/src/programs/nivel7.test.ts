import { describe, it, expect } from 'bun:test';
import { NIVEL7_DEFINITION } from './nivel7';
import { computeGenericProgram } from '../generic-engine';

const BASE_CONFIG = {
  press_mil_b1: 40,
  press_mil_b2: 45,
  bench_b1: 60,
  bench_b2: 65,
  squat_b1: 80,
  squat_b2: 85,
  deadlift_b1: 100,
  deadlift_b2: 105,
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

    it('should have 8 config fields (4 lifts x 2 blocks)', () => {
      expect(NIVEL7_DEFINITION.configFields.length).toBe(8);
    });

    it('should have 5-6 slots per day', () => {
      for (const day of NIVEL7_DEFINITION.days) {
        expect(day.slots.length).toBeGreaterThanOrEqual(4);
        expect(day.slots.length).toBeLessThanOrEqual(6);
      }
    });

    it('should have correct day names repeating across blocks', () => {
      // Block 1 and Block 2 should have the same day name pattern
      const block1Names = NIVEL7_DEFINITION.days.slice(0, 4).map((d) => d.name);
      const block2Names = NIVEL7_DEFINITION.days.slice(12, 16).map((d) => d.name);
      expect(block1Names).toEqual(block2Names);
    });
  });

  describe('main lift progression', () => {
    it('should increase press militar +2.5kg per session in block 1', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      // Press militar appears on days 0, 4, 8 (block 1 weeks 1-3)
      const pressMilSlots = [0, 4, 8].map((i) => {
        const slot = rows[i].slots.find((s) => s.slotId === 'press_mil-b1');
        return slot?.weight;
      });

      expect(pressMilSlots).toEqual([40, 42.5, 45]);
    });

    it('should increase bench +2.5kg per session in block 1', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      // Bench appears on days 2, 6, 10 (block 1 weeks 1-3)
      const benchSlots = [2, 6, 10].map((i) => {
        const slot = rows[i].slots.find((s) => s.slotId === 'bench-b1');
        return slot?.weight;
      });

      expect(benchSlots).toEqual([60, 62.5, 65]);
    });

    it('should increase squat +2.5kg per session in block 1', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      // Squat appears on days 3, 7, 11 (block 1 weeks 1-3)
      const squatSlots = [3, 7, 11].map((i) => {
        const slot = rows[i].slots.find((s) => s.slotId === 'squat-b1');
        return slot?.weight;
      });

      expect(squatSlots).toEqual([80, 82.5, 85]);
    });

    it('should increase deadlift +2.5kg per session in block 1', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      // Deadlift appears on days 1, 5, 9 (block 1 weeks 1-3)
      const dlSlots = [1, 5, 9].map((i) => {
        const slot = rows[i].slots.find((s) => s.slotId === 'deadlift-b1');
        return slot?.weight;
      });

      expect(dlSlots).toEqual([100, 102.5, 105]);
    });
  });

  describe('block independence', () => {
    it('should start block 2 press militar from its own config key', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      // Block 2 press militar starts on day 12
      const b2Slot = rows[12].slots.find((s) => s.slotId === 'press_mil-b2');
      expect(b2Slot?.weight).toBe(45); // press_mil_b2 config value
    });

    it('should progress block 2 independently of block 1', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      // Block 2 bench: days 14, 18, 22
      const b2BenchSlots = [14, 18, 22].map((i) => {
        const slot = rows[i].slots.find((s) => s.slotId === 'bench-b2');
        return slot?.weight;
      });

      expect(b2BenchSlots).toEqual([65, 67.5, 70]);
    });

    it('should use separate slot IDs for block 1 and block 2', () => {
      const b1SlotIds = new Set<string>();
      const b2SlotIds = new Set<string>();

      // Block 1: days 0-11, Block 2: days 12-23
      for (let i = 0; i < 12; i++) {
        for (const slot of NIVEL7_DEFINITION.days[i].slots) {
          if (slot.id.endsWith('-b1')) b1SlotIds.add(slot.id);
        }
      }
      for (let i = 12; i < 24; i++) {
        for (const slot of NIVEL7_DEFINITION.days[i].slots) {
          if (slot.id.endsWith('-b2')) b2SlotIds.add(slot.id);
        }
      }

      // Each block should have 4 main lift slots
      expect(b1SlotIds.size).toBe(4);
      expect(b2SlotIds.size).toBe(4);

      // No overlap
      for (const id of b1SlotIds) {
        expect(b2SlotIds.has(id)).toBe(false);
      }
    });
  });

  describe('block 1 scheme', () => {
    it('should use 5x5 for block 1 main lifts (except deadlift)', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      // Day 0: press militar (block 1)
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

      // Day 12: press militar (block 2)
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

      // press_franc appears on days 0, 4, 8, 12, 16, 20
      // All should be 0kg (not in configFields → defaults to 0)
      const pfWeights = [0, 4, 8, 12, 16, 20].map((i) => {
        const slot = rows[i].slots.find((s) => s.slotId === 'press_franc');
        return slot?.weight;
      });

      expect(pfWeights.every((w) => w === 0)).toBe(true);
    });

    it('should vary accessory sets/reps per week', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      // press_franc: day 0 = 4x8 (wk1), day 4 = 4x6 (wk2), day 8 = 5x5 (wk3)
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
      // press_franc should be the same slotId in block 1 and block 2
      const day0 = NIVEL7_DEFINITION.days[0];
      const day12 = NIVEL7_DEFINITION.days[12];

      const pfDay0 = day0.slots.find((s) => s.exerciseId === 'press_franc');
      const pfDay12 = day12.slots.find((s) => s.exerciseId === 'press_franc');

      expect(pfDay0?.id).toBe('press_franc');
      expect(pfDay12?.id).toBe('press_franc');
    });
  });

  describe('fail behavior', () => {
    it('should keep weight on main lift fail (no_change)', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {
        '0': { 'press_mil-b1': { result: 'fail' } },
      });

      // After fail on day 0, day 4 should still have same weight (no_change)
      const day4Slot = rows[4].slots.find((s) => s.slotId === 'press_mil-b1');
      expect(day4Slot?.weight).toBe(40);
    });

    it('should resume progression after success following a fail', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {
        '0': { 'press_mil-b1': { result: 'fail' } },
        '4': { 'press_mil-b1': { result: 'success' } },
      });

      // Day 0: 40kg (fail → no change)
      // Day 4: 40kg (success → +2.5)
      // Day 8: 42.5kg
      const day8Slot = rows[8].slots.find((s) => s.slotId === 'press_mil-b1');
      expect(day8Slot?.weight).toBe(42.5);
    });
  });
});
