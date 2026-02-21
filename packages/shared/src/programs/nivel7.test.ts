import { describe, it, expect } from 'bun:test';
import { NIVEL7_DEFINITION } from './nivel7';
import { computeGenericProgram } from '../generic-engine';

// Config values are the week-6 RECORD targets (cycle 1).
// Cycle 1: S1=T−10, S2=T−7.5, S3=T−10, S4=T−5, S5=T−2.5, S6=T
// Cycle 2: S7=T−7.5, S8=T−5, S9=T−7.5, S10=T−2.5, S11=T, S12=T+2.5
const BASE_CONFIG: Record<string, number> = {
  press_mil: 50,
  bench: 70,
  squat: 90,
  deadlift: 110,
  // Accessories default to 0
  press_franc: 0,
  ext_polea: 0,
  elev_lat: 0,
  elev_post: 0,
  elev_front: 0,
  remo_bar: 0,
  jalon: 0,
  face_pull: 0,
  gemelo_pie: 0,
  gemelo_sent: 0,
  apert: 0,
  cruces: 0,
  curl_bar: 0,
  curl_alt: 0,
  curl_mart: 0,
  prensa: 0,
  ext_quad: 0,
  curl_fem: 0,
  hip_thrust: 0,
  zancadas: 0,
  leg_press_gem: 0,
};

describe('NIVEL7_DEFINITION', () => {
  describe('structure', () => {
    it('should have 48 days (2 cycles × 24)', () => {
      expect(NIVEL7_DEFINITION.days.length).toBe(48);
    });

    it('should have totalWorkouts = 48', () => {
      expect(NIVEL7_DEFINITION.totalWorkouts).toBe(48);
    });

    it('should have 25 config fields (4 main + 21 accessories)', () => {
      expect(NIVEL7_DEFINITION.configFields.length).toBe(25);
    });

    it('should have a config field for every exercise', () => {
      const exerciseIds = Object.keys(NIVEL7_DEFINITION.exercises);
      const configKeys = NIVEL7_DEFINITION.configFields.map((f) => f.key);
      expect(configKeys.sort()).toEqual(exerciseIds.sort());
    });

    it('should repeat day names across cycles', () => {
      const cycle1Names = NIVEL7_DEFINITION.days.slice(0, 24).map((d) => d.name);
      const cycle2Names = NIVEL7_DEFINITION.days.slice(24, 48).map((d) => d.name);
      expect(cycle1Names).toEqual(cycle2Names);
    });
  });

  describe('cycle 1 wave periodization', () => {
    it('should derive press militar weights: T−10, T−7.5, T−10, T−5, T−2.5, T', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      const b1 = [0, 4].map(
        (i) => rows[i].slots.find((s) => s.slotId === 'press_mil-c1b1')?.weight
      );
      const deload = rows[8].slots.find((s) => s.slotId === 'press_mil-c1b1d')?.weight;
      const b2 = [12, 16, 20].map(
        (i) => rows[i].slots.find((s) => s.slotId === 'press_mil-c1b2')?.weight
      );

      expect(b1).toEqual([40, 42.5]);
      expect(deload).toBe(40);
      expect(b2).toEqual([45, 47.5, 50]);
    });

    it('should reach the exact target weight in cycle 1 final session', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      expect(rows[20].slots.find((s) => s.slotId === 'press_mil-c1b2')?.weight).toBe(50);
      expect(rows[22].slots.find((s) => s.slotId === 'bench-c1b2')?.weight).toBe(70);
      expect(rows[23].slots.find((s) => s.slotId === 'squat-c1b2')?.weight).toBe(90);
      expect(rows[21].slots.find((s) => s.slotId === 'deadlift-c1b2')?.weight).toBe(110);
    });
  });

  describe('cycle 2 wave periodization (+2.5kg escalation)', () => {
    it('should shift press militar wave by +2.5', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      const b1 = [24, 28].map(
        (i) => rows[i].slots.find((s) => s.slotId === 'press_mil-c2b1')?.weight
      );
      const deload = rows[32].slots.find((s) => s.slotId === 'press_mil-c2b1d')?.weight;
      const b2 = [36, 40, 44].map(
        (i) => rows[i].slots.find((s) => s.slotId === 'press_mil-c2b2')?.weight
      );

      expect(b1).toEqual([42.5, 45]);
      expect(deload).toBe(42.5);
      expect(b2).toEqual([47.5, 50, 52.5]);
    });

    it('should reach T+2.5 in cycle 2 final session', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      expect(rows[44].slots.find((s) => s.slotId === 'press_mil-c2b2')?.weight).toBe(52.5);
      expect(rows[46].slots.find((s) => s.slotId === 'bench-c2b2')?.weight).toBe(72.5);
      expect(rows[47].slots.find((s) => s.slotId === 'squat-c2b2')?.weight).toBe(92.5);
      expect(rows[45].slots.find((s) => s.slotId === 'deadlift-c2b2')?.weight).toBe(112.5);
    });
  });

  describe('deload behavior', () => {
    it('should keep deload weight fixed regardless of result', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {
        '8': { 'press_mil-c1b1d': { result: 'success' } },
      });

      expect(rows[8].slots.find((s) => s.slotId === 'press_mil-c1b1d')?.weight).toBe(40);
    });
  });

  describe('slot chains', () => {
    it('should use cycle-qualified slot IDs for main lifts', () => {
      const allMainIds = new Set<string>();

      for (const day of NIVEL7_DEFINITION.days) {
        for (const slot of day.slots) {
          if (
            slot.id.startsWith('press_mil-') ||
            slot.id.startsWith('bench-') ||
            slot.id.startsWith('squat-') ||
            slot.id.startsWith('deadlift-')
          ) {
            allMainIds.add(slot.id);
          }
        }
      }

      // 4 lifts × 3 phases × 2 cycles = 24 unique main lift slot IDs
      expect(allMainIds.size).toBe(24);
    });

    it('should use c1 slots in days 0-23 and c2 slots in days 24-47', () => {
      for (let i = 0; i < 24; i++) {
        const mainSlot = NIVEL7_DEFINITION.days[i].slots[0];
        expect(mainSlot.id).toContain('-c1');
      }
      for (let i = 24; i < 48; i++) {
        const mainSlot = NIVEL7_DEFINITION.days[i].slots[0];
        expect(mainSlot.id).toContain('-c2');
      }
    });
  });

  describe('block schemes', () => {
    it('should use 5x5 for block 1 and 3x3 for block 2 in both cycles', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      const c1b1 = rows[0].slots.find((s) => s.slotId === 'press_mil-c1b1');
      expect(c1b1?.sets).toBe(5);
      expect(c1b1?.reps).toBe(5);

      const c1b2 = rows[12].slots.find((s) => s.slotId === 'press_mil-c1b2');
      expect(c1b2?.sets).toBe(3);
      expect(c1b2?.reps).toBe(3);
    });

    it('should use 1x5/1x3 for deadlift', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      const dlB1 = rows[1].slots.find((s) => s.slotId === 'deadlift-c1b1');
      expect(dlB1?.sets).toBe(1);
      expect(dlB1?.reps).toBe(5);

      const dlB2 = rows[13].slots.find((s) => s.slotId === 'deadlift-c1b2');
      expect(dlB2?.sets).toBe(1);
      expect(dlB2?.reps).toBe(3);
    });
  });

  describe('accessory double progression (3×8-12)', () => {
    it('should start accessories at 3×8', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {});

      const pf = rows[0].slots.find((s) => s.slotId === 'press_franc');
      expect(pf?.sets).toBe(3);
      expect(pf?.reps).toBe(8);
      expect(pf?.weight).toBe(0);
    });

    it('should have 5 stages per accessory (8, 9, 10, 11, 12 reps)', () => {
      const pfSlot = NIVEL7_DEFINITION.days[0].slots.find((s) => s.id === 'press_franc');
      expect(pfSlot?.stages.length).toBe(5);
      expect(pfSlot?.stages.map((s) => s.reps)).toEqual([8, 9, 10, 11, 12]);
      expect(pfSlot?.stages.every((s) => s.sets === 3)).toBe(true);
    });

    it('should advance reps on success (8→9→10→11→12)', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {
        '0': { press_franc: { result: 'success' } },
        '4': { press_franc: { result: 'success' } },
        '8': { press_franc: { result: 'success' } },
        '12': { press_franc: { result: 'success' } },
      });

      // press_franc appears on days 0, 4, 8, 12, 16, 20 (all Mondays)
      expect(rows[0].slots.find((s) => s.slotId === 'press_franc')?.reps).toBe(8);
      expect(rows[4].slots.find((s) => s.slotId === 'press_franc')?.reps).toBe(9);
      expect(rows[8].slots.find((s) => s.slotId === 'press_franc')?.reps).toBe(10);
      expect(rows[12].slots.find((s) => s.slotId === 'press_franc')?.reps).toBe(11);
      expect(rows[16].slots.find((s) => s.slotId === 'press_franc')?.reps).toBe(12);
    });

    it('should add +2.5kg and reset to 8 reps when completing 3×12', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {
        '0': { press_franc: { result: 'success' } },
        '4': { press_franc: { result: 'success' } },
        '8': { press_franc: { result: 'success' } },
        '12': { press_franc: { result: 'success' } },
        '16': { press_franc: { result: 'success' } }, // 3×12 → +2.5kg, reset
      });

      // Day 16: 3×12 at 0kg (success → add 2.5, reset to stage 0)
      // Day 20: 3×8 at 2.5kg
      const day20 = rows[20].slots.find((s) => s.slotId === 'press_franc');
      expect(day20?.weight).toBe(2.5);
      expect(day20?.reps).toBe(8);
    });

    it('should keep weight and reps on fail', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {
        '0': { press_franc: { result: 'success' } }, // 8→9
        '4': { press_franc: { result: 'fail' } }, // fail at 9 → stay
      });

      // Day 4: 3×9 (fail → no change)
      // Day 8: still 3×9
      expect(rows[8].slots.find((s) => s.slotId === 'press_franc')?.reps).toBe(9);
      expect(rows[8].slots.find((s) => s.slotId === 'press_franc')?.weight).toBe(0);
    });

    it('should keep reps at 12 on fail at final stage', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {
        '0': { press_franc: { result: 'success' } },
        '4': { press_franc: { result: 'success' } },
        '8': { press_franc: { result: 'success' } },
        '12': { press_franc: { result: 'success' } },
        '16': { press_franc: { result: 'fail' } }, // fail at 12 → stay at 12
      });

      // Day 16: 3×12 (fail → no change, stay at stage 4)
      // Day 20: still 3×12
      expect(rows[20].slots.find((s) => s.slotId === 'press_franc')?.reps).toBe(12);
      expect(rows[20].slots.find((s) => s.slotId === 'press_franc')?.weight).toBe(0);
    });

    it('should share accessory state across cycles (continuous progression)', () => {
      // 12 sessions of press_franc across 48 workouts (all Mondays)
      // With all success: 8,9,10,11,12→+2.5,8,9,10,11,12→+2.5,8,9
      const allSuccess: Record<string, Record<string, { result: 'success' }>> = {};
      for (const day of [0, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44]) {
        allSuccess[String(day)] = { press_franc: { result: 'success' } };
      }

      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, allSuccess);

      // After 5 successes (days 0-16): +2.5kg, reset
      expect(rows[20].slots.find((s) => s.slotId === 'press_franc')?.weight).toBe(2.5);
      expect(rows[20].slots.find((s) => s.slotId === 'press_franc')?.reps).toBe(8);

      // After 10 successes (days 0-36): second +2.5kg, reset
      // Days 40,44 are sessions 11,12 → stages 0,1 at 5kg
      expect(rows[44].slots.find((s) => s.slotId === 'press_franc')?.weight).toBe(5);
      expect(rows[44].slots.find((s) => s.slotId === 'press_franc')?.reps).toBe(9);
    });
  });

  describe('main lift fail behavior', () => {
    it('should keep weight on build-phase fail', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {
        '0': { 'press_mil-c1b1': { result: 'fail' } },
      });

      const day4Slot = rows[4].slots.find((s) => s.slotId === 'press_mil-c1b1');
      expect(day4Slot?.weight).toBe(40);
    });

    it('should progress after success following a fail', () => {
      const rows = computeGenericProgram(NIVEL7_DEFINITION, BASE_CONFIG, {
        '36': { 'press_mil-c2b2': { result: 'fail' } },
        '40': { 'press_mil-c2b2': { result: 'success' } },
      });

      const day44Slot = rows[44].slots.find((s) => s.slotId === 'press_mil-c2b2');
      expect(day44Slot?.weight).toBe(50);
    });
  });
});
