// sheiko-7-4.ts — Sheiko 7.4 "Bench Press Only"
// 18 weeks × 4 days = 72 workouts (weeks 17-18 have reduced days)
//
// Source: Boris Sheiko, "Powerlifting: Foundations and Methods", Chapter 7.4
// Pages 327-344
//
// NOTE: This file exceeds the 600-line warning threshold. It is a pure data
// file encoding 72 unique workout days from the book. Splitting would
// fragment the program without improving readability.

import { SHEIKO_BENCH_ONLY_CONFIG_FIELDS } from './shared';
import {
  resetSlotCounter,
  compSlot,
  gpp,
  p,
  buildSheikoDays,
  buildExerciseMap,
  BP,
  GPP,
  type SheikoWeekPlan,
} from './sheiko-helpers';

// ── Shorthand alias for percentOf key ──
const B = 'bench1rm';

// ══════════════════════════════════════════════════════════════════════════
// WEEK DATA — 18 weeks × 4 days
// ══════════════════════════════════════════════════════════════════════════

function buildWeeks(): readonly SheikoWeekPlan[] {
  resetSlotCounter();

  // ── Week 1 ──
  const w1: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.paused2s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 5)]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.frontDelts, 6, 5),
        gpp(GPP.tricepsStanding, 6, 5),
        gpp(GPP.abs, 10, 3),
      ],
      // Day 2
      [
        compSlot(BP.competition, B, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 2, 5)]),
        gpp(GPP.lats, 8, 5),
        gpp(GPP.biceps, 8, 5),
        gpp(GPP.abs, 10, 4),
      ],
      // Day 3
      [
        compSlot(BP.board, B, [p(55, 3, 1), p(65, 3, 1), p(75, 3, 1), p(85, 2, 2), p(90, 1, 3)]),
        gpp(BP.dumbbell, 6, 5),
        gpp(GPP.pecs, 8, 5), // "Triceps lying" in book
        gpp(GPP.legPress, 5, 4),
      ],
      // Day 4
      [
        compSlot(BP.bands, B, [p(50, 5, 1), p(60, 5, 1), p(65, 5, 5)]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.medialDelts, 8, 5),
        gpp(GPP.biceps, 8, 4),
      ],
    ],
  };

  // ── Week 2 ──
  const w2: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.paused3s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 2, 4)]),
        gpp(GPP.pecs, 8, 4),
        compSlot(BP.slingshot, B, [p(60, 3, 1), p(70, 3, 1), p(80, 3, 1), p(85, 3, 4)]),
        gpp(GPP.tricepsPushdowns, 8, 5),
        gpp(GPP.hyperextensions, 8, 4),
      ],
      // Day 2
      [
        compSlot(BP.bands, B, [p(50, 4, 1), p(60, 4, 1), p(67, 4, 4)]),
        gpp(GPP.lats, 6, 5),
        gpp(GPP.medialDelts, 6, 5),
        gpp(GPP.biceps, 8, 5),
        gpp(GPP.legPress, 5, 5),
      ],
      // Day 3
      [
        compSlot(BP.paused3s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 4)]),
        gpp(GPP.frontDelts, 6, 5),
        compSlot(BP.board, B, [p(60, 3, 1), p(70, 3, 1), p(80, 3, 1), p(85, 3, 1), p(90, 2, 3)]),
        gpp(GPP.tricepsStanding, 6, 5),
        gpp(GPP.abs, 8, 4),
      ],
      // Day 4
      [
        compSlot(BP.competition, B, [p(50, 5, 1), p(60, 5, 1), p(70, 4, 4)]),
        gpp(GPP.lats, 8, 5),
        gpp(GPP.biceps, 8, 5),
        gpp(GPP.goodmorningSeat, 5, 5),
      ],
    ],
  };

  // ── Week 3 ──
  const w3: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.competition, B, [p(55, 5, 1), p(65, 4, 1), p(75, 3, 1), p(85, 2, 4)]),
        gpp(GPP.pecs, 8, 5),
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.pecs, 8, 5), // "Triceps lying"
        gpp(GPP.abs, 8, 4),
      ],
      // Day 2
      [
        compSlot(BP.chains, B, [p(50, 4, 1), p(60, 4, 1), p(70, 3, 5)]),
        gpp(GPP.lats, 8, 5),
        gpp(GPP.medialDelts, 6, 5),
        gpp(GPP.hyperextensions, 8, 4),
      ],
      // Day 3
      [
        compSlot(BP.paused2s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 2, 5)]),
        gpp(GPP.legPress, 5, 5),
        gpp(BP.dumbbell, 6, 4),
        gpp(GPP.tricepsPushdowns, 8, 5),
      ],
      // Day 4
      [
        gpp(BP.inclineShoulder, 4, 6),
        gpp(GPP.medialDelts, 6, 5),
        gpp(GPP.dips, 5, 5),
        gpp(GPP.legPress, 5, 5),
      ],
    ],
  };

  // ── Week 4 ──
  const w4: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.competition, B, [
          p(50, 5, 1),
          p(60, 4, 1),
          p(70, 3, 1),
          p(80, 3, 2),
          p(85, 2, 2),
          p(80, 3, 2),
        ]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.rearDelts, 6, 5),
        gpp(GPP.tricepsStanding, 6, 5),
      ],
      // Day 2
      [
        compSlot(BP.paused3s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 2, 4)]),
        gpp(GPP.lats, 6, 5),
        compSlot(BP.board, B, [p(60, 3, 1), p(70, 3, 1), p(80, 3, 1), p(85, 2, 2), p(90, 1, 3)]),
        gpp(GPP.hyperextensions, 8, 4),
      ],
      // Day 3
      [
        compSlot(BP.competition, B, [p(50, 5, 1), p(60, 5, 1), p(70, 5, 5)]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.frontDelts, 6, 5),
        gpp(GPP.biceps, 8, 5),
      ],
      // Day 4
      [
        compSlot(BP.slingshot, B, [p(55, 3, 1), p(65, 3, 1), p(75, 3, 1), p(85, 3, 4)]),
        gpp(GPP.lats, 8, 5),
        gpp(GPP.pecs, 8, 5), // "Triceps lying"
        gpp(GPP.abs, 8, 3),
      ],
    ],
  };

  // ── Week 5 ──
  const w5: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.competition, B, [p(55, 3, 1), p(65, 3, 1), p(75, 3, 1), p(85, 2, 4)]),
        gpp(GPP.squatGpp, 4, 5),
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.pecs, 6, 5),
        gpp(GPP.pecs, 6, 5), // "Triceps lying"
      ],
      // Day 2
      [
        compSlot(BP.paused2s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 2, 5)]),
        gpp(BP.dumbbell, 8, 5),
        gpp(GPP.medialDelts, 6, 5),
        gpp(GPP.abs, 10, 4),
      ],
      // Day 3
      [
        compSlot(BP.board, B, [
          p(55, 3, 1),
          p(65, 3, 1),
          p(75, 3, 1),
          p(80, 3, 1),
          p(85, 2, 2),
          p(90, 1, 3),
        ]),
        gpp(GPP.pecs, 6, 5),
        gpp(GPP.tricepsStanding, 6, 5),
        gpp(GPP.hyperextensions, 8, 4),
      ],
      // Day 4
      [
        compSlot(BP.speed, B, [p(40, 5, 2), p(50, 4, 3)]),
        gpp(GPP.dips, 5, 5),
        gpp(GPP.medialDelts, 6, 5),
        gpp(GPP.biceps, 8, 4),
      ],
    ],
  };

  // ── Week 6 ──
  const w6: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.competition, B, [
          p(50, 5, 1),
          p(60, 4, 1),
          p(70, 3, 1),
          p(80, 3, 2),
          p(85, 2, 4),
        ]),
        gpp(GPP.pecs, 8, 5),
        gpp(BP.inclineShoulder, 4, 5),
        gpp(GPP.tricepsStanding, 6, 5),
      ],
      // Day 2
      [
        compSlot(BP.board, B, [
          p(55, 3, 1),
          p(65, 3, 1),
          p(75, 3, 1),
          p(85, 3, 2),
          p(90, 2, 2),
          p(95, 1, 2),
        ]),
        gpp(GPP.squatGpp, 5, 4),
        compSlot(BP.paused2s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 2, 3)]),
        gpp(GPP.rearDelts, 8, 5),
        gpp(GPP.hyperextensions, 8, 4),
      ],
      // Day 3
      [
        compSlot(BP.competition, B, [p(50, 6, 1), p(60, 6, 1), p(70, 6, 5)]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.frontDelts, 6, 5),
        gpp(GPP.biceps, 8, 5),
      ],
      // Day 4
      [
        compSlot(BP.slingshot, B, [p(60, 3, 1), p(70, 3, 1), p(80, 2, 2), p(90, 1, 3)]),
        gpp(BP.dumbbell, 6, 5),
        gpp(GPP.dips, 4, 5),
        gpp(GPP.abs, 10, 3),
      ],
    ],
  };

  // ── Week 7 ──
  const w7: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.competition, B, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(75, 3, 5)]),
        gpp(GPP.pecs, 6, 5),
        gpp(GPP.tricepsPushdowns, 6, 5),
        gpp(GPP.frontDelts, 6, 5),
        gpp(GPP.hyperextensions, 10, 3),
      ],
      // Day 2
      [
        compSlot(BP.paused2s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 2, 5)]),
        gpp(BP.dumbbell, 6, 5),
        gpp(GPP.lats, 8, 5),
        gpp(GPP.pecs, 6, 5), // "Triceps lying"
      ],
      // Day 3
      [
        compSlot(BP.competition, B, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.squatGpp, 4, 5),
        compSlot(BP.slingshot, B, [
          p(60, 3, 1),
          p(70, 3, 1),
          p(80, 3, 1),
          p(85, 2, 2),
          p(90, 1, 3),
        ]),
        gpp(GPP.pecs, 6, 5),
        gpp(GPP.abs, 10, 3),
      ],
      // Day 4
      [
        gpp(BP.inclineShoulder, 4, 5),
        gpp(BP.dumbbell, 6, 5),
        gpp(GPP.tricepsPushdowns, 6, 5),
        gpp(GPP.hyperextensions, 8, 4),
      ],
    ],
  };

  // ── Week 8 ──
  const w8: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.paused2s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 3, 5)]),
        gpp(GPP.pecs, 6, 5),
        gpp(GPP.frontDelts, 6, 5),
        gpp(GPP.pecs, 8, 5), // "Triceps lying"
      ],
      // Day 2
      [
        compSlot(BP.competition, B, [p(50, 5, 1), p(60, 5, 1), p(70, 4, 5)]),
        gpp(BP.dumbbell, 6, 5),
        gpp(GPP.tricepsPushdowns, 8, 5),
        gpp(GPP.hyperextensions, 8, 4),
      ],
      // Day 3
      [
        compSlot(BP.competition, B, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.squatGpp, 4, 5),
        compSlot(BP.board, B, [p(60, 3, 1), p(70, 3, 1), p(80, 3, 1), p(85, 2, 1), p(90, 1, 3)]),
        gpp(GPP.lats, 8, 5),
        gpp(GPP.legPress, 4, 5),
      ],
      // Day 4
      [
        compSlot(BP.speed, B, [p(40, 4, 2), p(50, 4, 3)]),
        gpp(GPP.medialDelts, 6, 4),
        gpp(GPP.tricepsStanding, 6, 4),
        gpp(GPP.abs, 10, 3),
      ],
    ],
  };

  // ── Week 9 — TEST ──
  const w9: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.competition, B, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(75, 2, 3)]),
        gpp(GPP.lats, 6, 4),
        gpp(GPP.medialDelts, 6, 4),
        gpp(GPP.legExtensions, 6, 4),
        gpp(GPP.abs, 8, 4),
      ],
      // Day 2 — BENCH TEST
      [
        compSlot(BP.competition, B, [
          p(50, 5, 1),
          p(60, 4, 1),
          p(70, 3, 1),
          p(80, 2, 1),
          p(85, 1, 1),
          p(90, 1, 1),
          p(95, 1, 1),
          p(100, 1, 1),
          p(105, 1, 1),
        ]),
        gpp(GPP.pecs, 6, 4),
        gpp(GPP.pecs, 6, 4), // "Triceps lying"
        gpp(GPP.goodmorningSeat, 4, 4),
      ],
      // Day 3
      [
        compSlot(BP.slingshot, B, [p(55, 3, 1), p(65, 3, 1), p(75, 3, 1), p(85, 2, 4)]),
        gpp(BP.dumbbell, 6, 5),
        gpp(GPP.pecs, 6, 5),
        gpp(GPP.frontDelts, 6, 5),
        gpp(GPP.squatGpp, 4, 5),
      ],
      // Day 4
      [
        compSlot(BP.speed, B, [p(40, 5, 2), p(50, 5, 3)]),
        gpp(GPP.tricepsPushdowns, 8, 5),
        gpp(GPP.lats, 8, 5),
        gpp(GPP.reverseHyperextensions, 8, 4),
      ],
    ],
  };

  // ── Week 10 ──
  const w10: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.competition, B, [p(55, 5, 1), p(65, 4, 1), p(75, 3, 1), p(85, 2, 4)]),
        gpp(GPP.squatGpp, 4, 5),
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.pecs, 8, 5), // "Triceps lying"
      ],
      // Day 2
      [
        compSlot(BP.paused3s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 4)]),
        gpp(BP.dumbbell, 6, 5),
        gpp(GPP.medialDelts, 6, 5),
        gpp(GPP.lats, 8, 5),
      ],
      // Day 3
      [
        compSlot(BP.board, B, [p(60, 3, 1), p(70, 3, 1), p(80, 3, 1), p(85, 2, 2), p(90, 1, 2)]),
        gpp(GPP.legPress, 5, 4),
        compSlot(BP.bands, B, [p(50, 4, 1), p(60, 4, 1), p(70, 4, 4)]),
        gpp(GPP.pecs, 6, 5),
        gpp(GPP.abs, 10, 3),
      ],
      // Day 4
      [
        compSlot(BP.speed, B, [p(40, 4, 1), p(50, 4, 4)]),
        gpp(BP.inclineShoulder, 3, 5),
        gpp(GPP.seatedRowing, 8, 5),
        gpp(GPP.goodmorningSeat, 5, 4),
      ],
    ],
  };

  // ── Week 11 ──
  const w11: SheikoWeekPlan = {
    days: [
      // Day 1 — Bench pyramid
      [
        compSlot(BP.competition, B, [
          p(50, 6, 1),
          p(60, 5, 1),
          p(70, 4, 1),
          p(75, 3, 1),
          p(80, 2, 2),
          p(85, 1, 2),
          p(75, 3, 1),
          p(65, 5, 1),
          p(55, 7, 1),
        ]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.tricepsStanding, 6, 5),
        gpp(GPP.hyperextensions, 8, 4),
      ],
      // Day 2
      [
        compSlot(BP.paused2s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 2, 4)]),
        gpp(GPP.legExtensions, 8, 4),
        compSlot(BP.chains, B, [p(50, 4, 1), p(60, 4, 1), p(70, 4, 4)]),
        gpp(GPP.lats, 8, 5),
        gpp(GPP.abs, 10, 4),
      ],
      // Day 3
      [
        compSlot(BP.board, B, [p(60, 3, 1), p(70, 3, 1), p(80, 3, 1), p(85, 2, 2), p(90, 1, 3)]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.pecs, 6, 5), // "Triceps lying"
        gpp(GPP.goodmorning, 5, 5),
      ],
      // Day 4
      [
        compSlot(BP.speed, B, [p(40, 4, 1), p(45, 4, 1), p(50, 4, 4)]),
        gpp(GPP.medialDelts, 6, 5),
        gpp(GPP.lats, 8, 5),
        gpp(GPP.abs, 10, 3),
      ],
    ],
  };

  // ── Week 12 ──
  const w12: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.paused3s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 2, 4)]),
        gpp(GPP.squatGpp, 4, 5),
        compSlot(BP.bands, B, [p(50, 4, 1), p(60, 4, 1), p(65, 4, 4)]),
        gpp(GPP.tricepsStanding, 6, 5),
        gpp(GPP.abs, 10, 3),
      ],
      // Day 2
      [
        compSlot(BP.competition, B, [
          p(50, 5, 1),
          p(60, 4, 1),
          p(70, 3, 1),
          p(80, 3, 2),
          p(85, 2, 3),
          p(80, 3, 2),
        ]),
        gpp(GPP.pecs, 8, 5),
        gpp(BP.dumbbell, 6, 5),
        gpp(GPP.medialDelts, 6, 5),
        gpp(GPP.hyperextensions, 10, 4),
      ],
      // Day 3
      [
        compSlot(BP.board, B, [
          p(55, 3, 1),
          p(65, 3, 1),
          p(75, 3, 1),
          p(85, 3, 2),
          p(90, 2, 2),
          p(95, 1, 2),
        ]),
        gpp(GPP.lats, 8, 5),
        gpp(GPP.tricepsPushdowns, 8, 5),
        gpp(GPP.abs, 10, 3),
      ],
      // Day 4
      [
        gpp(BP.inclineShoulder, 4, 5),
        gpp(BP.dumbbell, 6, 5),
        gpp(GPP.biceps, 8, 5),
        gpp(GPP.goodmorningSeat, 5, 4),
      ],
    ],
  };

  // ── Week 13 ──
  const w13: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.competition, B, [
          p(50, 5, 1),
          p(60, 4, 1),
          p(70, 3, 1),
          p(80, 2, 2),
          p(85, 1, 3),
        ]),
        gpp(GPP.pecs, 6, 5),
        gpp(GPP.frontDelts, 6, 5),
        gpp(GPP.tricepsPushdowns, 8, 5),
        gpp(GPP.legPress, 4, 4),
      ],
      // Day 2
      [
        compSlot(BP.board, B, [
          p(55, 3, 1),
          p(65, 3, 1),
          p(75, 3, 1),
          p(85, 2, 1),
          p(90, 2, 1),
          p(95, 1, 1),
          p(100, 1, 2),
        ]),
        gpp(GPP.lats, 8, 5),
        gpp(GPP.biceps, 8, 4),
        gpp(GPP.abs, 10, 3),
      ],
      // Day 3
      [
        compSlot(BP.paused3s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 2, 4)]),
        gpp(GPP.pecs, 6, 5),
        gpp(GPP.medialDelts, 6, 4),
        gpp(GPP.pecs, 6, 5), // "Triceps lying"
        gpp(GPP.reverseHyperextensions, 10, 4),
      ],
      // Day 4
      [
        compSlot(BP.bands, B, [p(50, 4, 1), p(60, 4, 1), p(65, 4, 4)]),
        gpp(BP.dumbbell, 6, 5),
        gpp(GPP.lats, 8, 4),
        gpp(GPP.legExtensions, 10, 5),
      ],
    ],
  };

  // ── Week 14 ──
  const w14: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.competition, B, [p(55, 5, 1), p(65, 4, 1), p(75, 3, 1), p(85, 2, 4)]),
        gpp(GPP.squatGpp, 4, 5),
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.abs, 10, 3),
      ],
      // Day 2
      [
        compSlot(BP.paused3s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 3, 5)]),
        gpp(BP.dumbbell, 6, 4),
        gpp(GPP.lats, 6, 5),
        gpp(GPP.frontDelts, 6, 4),
      ],
      // Day 3
      [
        compSlot(BP.chains, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 2, 4)]),
        gpp(GPP.legPress, 5, 5),
        compSlot(BP.slingshot, B, [
          p(60, 3, 1),
          p(70, 3, 1),
          p(80, 3, 1),
          p(85, 2, 1),
          p(90, 1, 2),
          p(95, 1, 3),
        ]),
        gpp(GPP.tricepsStanding, 6, 5),
        gpp(GPP.abs, 10, 3),
      ],
      // Day 4
      [
        compSlot(BP.paused2s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 2, 4)]),
        gpp(GPP.lats, 6, 5),
        gpp(GPP.tricepsPushdowns, 6, 4),
        gpp(GPP.hyperextensions, 6, 3),
      ],
    ],
  };

  // ── Week 15 ──
  const w15: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.competition, B, [p(55, 3, 1), p(65, 3, 1), p(75, 2, 1), p(85, 1, 4)]),
        gpp(GPP.squatGpp, 4, 4),
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.pecs, 6, 5),
        gpp(GPP.abs, 8, 3),
      ],
      // Day 2
      [
        compSlot(BP.board, B, [
          p(50, 3, 1),
          p(60, 3, 1),
          p(70, 3, 1),
          p(80, 3, 1),
          p(85, 2, 1),
          p(90, 1, 1),
          p(95, 1, 3),
        ]),
        gpp(GPP.legExtensions, 6, 4),
        gpp(GPP.tricepsPushdowns, 6, 5),
        gpp(GPP.hyperextensions, 8, 4),
      ],
      // Day 3
      [
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 5)]),
        gpp(GPP.squatGpp, 4, 5),
        gpp(GPP.lats, 6, 5),
        gpp(GPP.medialDelts, 6, 5),
      ],
      // Day 4
      [
        compSlot(BP.speed, B, [p(40, 4, 4)]),
        gpp(GPP.medialDelts, 6, 4),
        gpp(GPP.pecs, 6, 4), // "Triceps lying"
        gpp(GPP.abs, 8, 3),
      ],
    ],
  };

  // ── Week 16 ──
  const w16: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 2, 3)]),
        gpp(GPP.pecs, 6, 4),
        gpp(GPP.frontDelts, 6, 5),
        gpp(GPP.abs, 8, 3),
      ],
      // Day 2 — BENCH TEST
      [
        compSlot(BP.competition, B, [
          p(50, 3, 1),
          p(60, 3, 1),
          p(70, 3, 1),
          p(80, 2, 1),
          p(85, 1, 1),
          p(90, 1, 1),
          p(95, 1, 1),
          p(100, 1, 1),
          p(105, 1, 1),
        ]),
        gpp(GPP.lats, 6, 4),
        gpp(GPP.pecs, 6, 4), // "Triceps lying"
        gpp(GPP.hyperextensions, 8, 3),
      ],
      // Day 3
      [
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.pecs, 6, 4),
        gpp(GPP.medialDelts, 6, 5),
        gpp(GPP.abs, 8, 3),
      ],
      // Day 4
      [
        compSlot(BP.speed, B, [p(40, 4, 2), p(45, 4, 3)]),
        gpp(GPP.lats, 6, 4),
        gpp(GPP.legExtensions, 8, 4),
        gpp(GPP.reverseHyperextensions, 8, 3),
      ],
    ],
  };

  // ── Week 17 ──
  const w17: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.competition, B, [
          p(50, 3, 1),
          p(60, 3, 1),
          p(70, 3, 1),
          p(80, 2, 2),
          p(85, 1, 2),
        ]),
        gpp(GPP.pecs, 6, 4),
        gpp(GPP.frontDelts, 6, 4),
        gpp(GPP.abs, 8, 3),
      ],
      // Day 2
      [
        compSlot(BP.competition, B, [
          p(50, 3, 1),
          p(60, 3, 1),
          p(70, 3, 1),
          p(75, 2, 2),
          p(80, 1, 3),
        ]),
        gpp(GPP.tricepsPushdowns, 6, 4),
        gpp(GPP.hyperextensions, 6, 3),
      ],
      // Day 3
      [
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 2, 2), p(75, 2, 3)]),
        gpp(GPP.pecs, 6, 4),
        gpp(GPP.abs, 8, 3),
      ],
      // Day 4 — REST
      [],
    ],
  };

  // ── Week 18 ──
  const w18: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 2, 2), p(75, 1, 3)]),
        gpp(GPP.pecs, 6, 3),
        gpp(GPP.abs, 8, 2),
      ],
      // Day 2
      [compSlot(BP.competition, B, [p(50, 3, 1), p(60, 2, 2), p(70, 1, 3)])],
      // Days 3-4: REST + COMPETITION
      [],
      [],
    ],
  };

  return [w1, w2, w3, w4, w5, w6, w7, w8, w9, w10, w11, w12, w13, w14, w15, w16, w17, w18];
}

// ══════════════════════════════════════════════════════════════════════════
// PROGRAM DEFINITION
// ══════════════════════════════════════════════════════════════════════════

function buildDefinition(): Record<string, unknown> {
  const weeks = buildWeeks();
  const allDays = buildSheikoDays(weeks);

  // Filter out empty rest days
  const activeDays = allDays.filter((d) => d.slots.length > 0);
  const exercises = buildExerciseMap(activeDays);

  // Build weight increments (all zero — Sheiko uses fixed %1RM)
  const weightIncrements: Record<string, number> = {};
  for (const id of Object.keys(exercises)) {
    weightIncrements[id] = 0;
  }

  return {
    id: 'tenkaichi-budokai-solo-banca',
    name: 'Sheiko 7.4 — Solo Press Banca',
    description:
      'Programa Sheiko de 18 semanas exclusivo para press banca. ' +
      'Sin sentadilla ni peso muerto de competicion. ' +
      'Press banca y variaciones (pausado, tabla, slingshot, bandas, cadenas, velocidad). ' +
      '4 entrenamientos por semana. Basado en el libro "Powerlifting: Foundations and Methods".',
    author: 'Boris Sheiko',
    version: 1,
    category: 'powerlifting',
    source: 'preset',
    days: activeDays,
    cycleLength: activeDays.length,
    totalWorkouts: activeDays.length,
    workoutsPerWeek: 4,
    exercises,
    configFields: SHEIKO_BENCH_ONLY_CONFIG_FIELDS,
    weightIncrements,
    displayMode: 'flat',
    configTitle: '1RM de Competicion (kg)',
    configDescription:
      'Introduce tu 1RM REAL de press banca. ' +
      'Usa tu mejor marca reciente, no tu maximo deseado.',
    configEditTitle: 'Editar 1RM de Press Banca (kg)',
    configEditDescription:
      'Actualiza tu 1RM — los pesos del programa se recalcularan automaticamente.',
  };
}

export const SHEIKO_7_4_DEFINITION = buildDefinition();
