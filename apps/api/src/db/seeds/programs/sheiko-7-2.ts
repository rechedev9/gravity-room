// sheiko-7-2.ts — Sheiko 7.2 "Three Lifts: Bench Press Emphasis"
// 16 weeks × 4 days = 64 workouts (weeks 15-16 have reduced days)
//
// Source: Boris Sheiko, "Powerlifting: Foundations and Methods", Chapter 7.2
// Pages 295-310
//
// NOTE: This file exceeds the 600-line warning threshold. It is a pure data
// file encoding 64 unique workout days from the book. Splitting would
// fragment the program without improving readability.

import { SHEIKO_1RM_CONFIG_FIELDS, SHEIKO_1RM_CONFIG_STRINGS } from './shared';
import {
  resetSlotCounter,
  compSlot,
  gpp,
  p,
  buildSheikoDays,
  buildExerciseMap,
  SQ,
  BP,
  DL,
  GPP,
  type SheikoWeekPlan,
} from './sheiko-helpers';

// ── Shorthand aliases for percentOf keys ──
const S = 'squat1rm';
const B = 'bench1rm';
const D = 'deadlift1rm';

// ══════════════════════════════════════════════════════════════════════════
// WEEK DATA — 16 weeks × 4 days
// ══════════════════════════════════════════════════════════════════════════

function buildWeeks(): readonly SheikoWeekPlan[] {
  resetSlotCounter();

  // ── Week 1 ──
  const w1: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(SQ.competition, S, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(75, 3, 4)]),
        compSlot(BP.competition, B, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.frontDelts, 6, 5),
        gpp(GPP.tricepsStanding, 6, 5),
      ],
      // Day 2
      [
        compSlot(BP.paused2s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 2, 4)]),
        compSlot(DL.competition, D, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        compSlot(BP.board, B, [p(60, 3, 1), p(70, 3, 1), p(80, 3, 1), p(85, 2, 4)]),
        gpp(GPP.lats, 8, 5),
        gpp(GPP.abs, 8, 4),
      ],
      // Day 3
      [
        compSlot(SQ.competition, S, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 2, 4)]),
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
        gpp(GPP.tricepsPushdowns, 8, 5),
        gpp(GPP.hyperextensions, 8, 4),
      ],
      // Day 4
      [
        compSlot(DL.deficit, D, [p(50, 3, 1), p(60, 3, 1), p(65, 3, 4)]),
        gpp(BP.inclineShoulder, 4, 5),
        gpp(BP.dumbbell, 6, 5),
        gpp(GPP.reverseHyperextensions, 8, 4),
      ],
    ],
  };

  // ── Week 2 ──
  const w2: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.competition, B, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 2, 4)]),
        compSlot(SQ.competition, S, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 2, 4)]),
        compSlot(BP.bands, B, [p(50, 5, 1), p(60, 5, 1), p(65, 5, 4)]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.hyperextensions, 8, 4),
      ],
      // Day 2
      [
        compSlot(BP.slingshot, B, [
          p(55, 3, 1),
          p(65, 3, 1),
          p(75, 3, 1),
          p(85, 2, 2),
          p(90, 1, 3),
        ]),
        compSlot(DL.competition, D, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.medialDelts, 6, 5),
        gpp(GPP.tricepsStanding, 6, 5),
        gpp(GPP.lats, 8, 5),
      ],
      // Day 3
      [
        compSlot(BP.paused2s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 3, 4)]),
        compSlot(SQ.competition, S, [p(50, 5, 1), p(60, 5, 1), p(70, 4, 4)]),
        compSlot(BP.board, B, [p(60, 3, 1), p(70, 3, 1), p(80, 3, 1), p(85, 2, 2), p(90, 1, 3)]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.abs, 10, 3),
      ],
      // Day 4
      [
        compSlot(BP.decline, B, [p(50, 4, 1), p(60, 4, 1), p(70, 4, 4)]),
        compSlot(DL.plusBelowKnees, D, [p(50, 1, 1), p(60, 1, 1), p(70, 1, 1), p(75, 1, 4)], '1+3'),
        gpp(BP.dumbbell, 6, 5),
        gpp(GPP.medialDelts, 8, 5),
        gpp(GPP.reverseHyperextensions, 8, 5),
      ],
    ],
  };

  // ── Week 3 ──
  const w3: SheikoWeekPlan = {
    days: [
      // Day 1 — "3,2,1 sec paused bench press"
      [
        compSlot(BP.paused3s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 3, 4)]),
        compSlot(SQ.pauseHalfDown, S, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 4)]),
        compSlot(BP.board, B, [p(60, 3, 1), p(70, 3, 1), p(80, 3, 1), p(90, 2, 3)]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.tricepsStanding, 8, 5),
      ],
      // Day 2
      [
        compSlot(BP.competition, B, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 2, 5)]),
        compSlot(DL.competition, D, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.lats, 8, 5),
        gpp(GPP.frontDelts, 6, 5),
        gpp(GPP.legCurls, 8, 5),
      ],
      // Day 3
      [
        compSlot(SQ.competition, S, [p(50, 5, 1), p(60, 5, 1), p(70, 4, 4)]),
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
        gpp(GPP.pecs, 8, 5), // "Biceps" in book
        gpp(GPP.goodmorning, 4, 5),
      ],
      // Day 4
      [
        compSlot(DL.blocks, D, [p(60, 3, 1), p(70, 3, 1), p(80, 3, 1), p(85, 3, 4)]),
        compSlot(BP.speed, B, [p(40, 4, 1), p(50, 4, 4)]),
        gpp(BP.dumbbell, 6, 5),
        gpp(GPP.legExtensions, 8, 5),
        gpp(GPP.abs, 8, 4),
      ],
    ],
  };

  // ── Week 4 ──
  const w4: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.competition, B, [p(55, 5, 1), p(65, 4, 1), p(75, 3, 1), p(85, 2, 4)]),
        compSlot(SQ.paused2s, S, [p(50, 3, 1), p(60, 3, 1), p(65, 3, 4)]),
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.hyperextensions, 8, 4),
      ],
      // Day 2 — "4,3,2 sec paused bench press"
      [
        compSlot(BP.paused3s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 5)]),
        compSlot(DL.competition, D, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.frontDelts, 6, 5),
        gpp(GPP.lats, 8, 5),
        gpp(GPP.abs, 10, 3),
      ],
      // Day 3
      [
        compSlot(BP.board, B, [p(60, 3, 1), p(70, 3, 1), p(80, 3, 1), p(85, 3, 2), p(90, 2, 3)]),
        compSlot(SQ.competition, S, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 2, 4)]),
        compSlot(BP.chains, B, [p(50, 4, 1), p(60, 4, 1), p(70, 4, 4)]),
        gpp(GPP.pecs, 6, 5),
        gpp(GPP.goodmorningSeat, 5, 5),
      ],
      // Day 4
      [
        compSlot(DL.blocks, D, [p(60, 3, 1), p(70, 3, 1), p(80, 3, 1), p(85, 2, 1), p(90, 1, 3)]),
        compSlot(BP.decline, B, [p(50, 5, 1), p(60, 5, 1), p(70, 5, 4)]),
        gpp(BP.inclineShoulder, 4, 5),
        gpp(GPP.pecs, 8, 5),
      ],
    ],
  };

  // ── Week 5 ──
  const w5: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.board, B, [
          p(55, 3, 1),
          p(65, 3, 1),
          p(75, 3, 1),
          p(85, 2, 1),
          p(90, 1, 2),
          p(95, 1, 2),
        ]),
        compSlot(SQ.pauseHalfDown, S, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 4)]),
        compSlot(BP.bands, B, [p(50, 4, 1), p(60, 4, 1), p(65, 4, 4)]),
        gpp(GPP.pecs, 6, 5),
        gpp(GPP.hyperextensions, 8, 4),
      ],
      // Day 2
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
        compSlot(DL.competition, D, [
          p(50, 3, 1),
          p(60, 3, 1),
          p(70, 3, 1),
          p(80, 2, 2),
          p(85, 1, 3),
        ]),
        gpp(GPP.medialDelts, 8, 5),
        gpp(GPP.lats, 6, 5),
        gpp(GPP.abs, 10, 3),
      ],
      // Day 3
      [
        compSlot(SQ.competition, S, [
          p(50, 5, 1),
          p(60, 4, 1),
          p(70, 3, 1),
          p(80, 2, 2),
          p(85, 1, 3),
        ]),
        compSlot(BP.paused3s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 2, 5)]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.tricepsStanding, 6, 5),
        gpp(GPP.hyperextensions, 8, 4),
      ],
      // Day 4
      [
        compSlot(DL.blocksChains, D, [p(55, 3, 1), p(65, 3, 1), p(75, 3, 1), p(85, 2, 4)]),
        gpp(BP.inclineShoulder, 4, 5),
        gpp(BP.dumbbell, 6, 5),
        gpp(GPP.medialDelts, 6, 5),
        gpp(GPP.reverseHyperextensions, 8, 4),
      ],
    ],
  };

  // ── Week 6 ──
  const w6: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.competition, B, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 2, 4)]),
        compSlot(SQ.competition, S, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 3, 4)]),
        compSlot(BP.chains, B, [p(50, 4, 1), p(60, 4, 1), p(70, 4, 4)]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.goodmorning, 5, 4),
      ],
      // Day 2
      [
        compSlot(BP.competition, B, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 3, 4)]),
        compSlot(DL.competition, D, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 3, 4)]),
        gpp(GPP.medialDelts, 6, 5),
        gpp(GPP.tricepsStanding, 6, 5),
        gpp(GPP.legCurls, 8, 5),
      ],
      // Day 3
      [
        compSlot(BP.paused2s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 3, 4)]),
        compSlot(SQ.competition, S, [p(50, 5, 1), p(60, 5, 1), p(70, 5, 4)]),
        compSlot(BP.board, B, [p(60, 3, 1), p(70, 3, 1), p(80, 3, 1), p(85, 2, 2), p(90, 1, 3)]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.abs, 10, 3),
      ],
      // Day 4
      [
        compSlot(BP.competition, B, [p(50, 5, 1), p(60, 5, 1), p(70, 4, 5)]),
        compSlot(DL.blocks, D, [p(60, 3, 1), p(70, 3, 1), p(80, 3, 1), p(85, 3, 4)]),
        gpp(GPP.lats, 8, 5),
        gpp(GPP.frontDelts, 6, 5),
        gpp(GPP.reverseHyperextensions, 8, 4),
      ],
    ],
  };

  // ── Week 7 ──
  const w7: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(SQ.pauseHalfDown, S, [
          p(50, 3, 1),
          p(60, 3, 1),
          p(65, 3, 1),
          p(70, 3, 1),
          p(75, 2, 4),
        ]),
        compSlot(BP.competition, B, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 3, 5)]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.tricepsStanding, 6, 5),
        gpp(GPP.hyperextensions, 8, 4),
      ],
      // Day 2
      [
        compSlot(BP.competition, B, [p(55, 5, 1), p(65, 4, 1), p(75, 3, 1), p(85, 2, 4)]),
        compSlot(DL.plusBelowKnees, D, [p(50, 1, 1), p(60, 1, 1), p(70, 1, 1), p(75, 1, 4)], '1+2'),
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.lats, 8, 5),
        gpp(GPP.frontDelts, 6, 5),
      ],
      // Day 3
      [
        compSlot(SQ.competition, S, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 3, 4)]),
        compSlot(BP.chains, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 2, 4)]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.pecs, 8, 5), // "Biceps" in book
        gpp(GPP.hyperextensions, 8, 5),
      ],
      // Day 4
      [
        compSlot(DL.chains, D, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 2, 4)]),
        compSlot(BP.speed, B, [p(40, 4, 1), p(50, 4, 4)]),
        gpp(BP.dumbbell, 6, 5),
        gpp(GPP.medialDelts, 6, 5),
        gpp(GPP.abs, 10, 3),
      ],
    ],
  };

  // ── Week 8 ──
  const w8: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(SQ.competition, S, [
          p(50, 5, 1),
          p(60, 4, 1),
          p(70, 3, 1),
          p(80, 3, 2),
          p(85, 2, 4),
        ]),
        compSlot(BP.competition, B, [
          p(50, 5, 1),
          p(60, 4, 1),
          p(70, 3, 1),
          p(80, 3, 2),
          p(85, 2, 4),
        ]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.tricepsStanding, 6, 5),
        gpp(GPP.hyperextensions, 8, 5),
      ],
      // Day 2
      [
        compSlot(BP.paused3s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 4)]),
        compSlot(DL.plusBelowKnees, D, [p(50, 1, 1), p(60, 1, 1), p(70, 1, 1), p(75, 1, 4)], '1+3'),
        compSlot(BP.board, B, [p(55, 3, 1), p(65, 3, 1), p(75, 3, 1), p(85, 2, 2), p(90, 1, 2)]),
        gpp(GPP.lats, 8, 5),
        gpp(GPP.abs, 10, 3),
      ],
      // Day 3
      [
        compSlot(SQ.chains, S, [p(50, 4, 1), p(60, 4, 1), p(70, 4, 4)]),
        compSlot(BP.competition, B, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.pecs, 6, 5),
        gpp(GPP.tricepsStanding, 6, 4),
        gpp(GPP.goodmorning, 5, 4),
      ],
      // Day 4
      [
        compSlot(DL.competition, D, [
          p(50, 3, 1),
          p(60, 3, 1),
          p(70, 3, 1),
          p(80, 2, 2),
          p(85, 1, 2),
        ]),
        gpp(BP.inclineShoulder, 3, 4),
        gpp(GPP.frontDelts, 6, 4),
        gpp(GPP.reverseHyperextensions, 6, 4),
      ],
    ],
  };

  // ── Week 9 ──
  const w9: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.competition, B, [p(55, 5, 1), p(65, 4, 1), p(75, 3, 1), p(85, 2, 4)]),
        compSlot(SQ.competition, S, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 2, 4)]),
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.pecs, 6, 5),
        gpp(GPP.goodmorning, 5, 4),
      ],
      // Day 2
      [
        compSlot(BP.slingshot, B, [
          p(55, 3, 1),
          p(65, 3, 1),
          p(75, 3, 1),
          p(85, 2, 2),
          p(90, 1, 2),
        ]),
        compSlot(DL.kneesFull, D, [p(50, 3, 1), p(60, 3, 1), p(70, 2, 1), p(75, 2, 4)], '3+1'),
        gpp(GPP.medialDelts, 6, 5),
        gpp(GPP.lats, 8, 5),
        gpp(GPP.abs, 10, 3),
      ],
      // Day 3
      [
        compSlot(SQ.competition, S, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 2, 4)]),
        compSlot(BP.competition, B, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(75, 2, 3)]),
        gpp(GPP.pecs, 6, 5),
        gpp(GPP.tricepsStanding, 6, 5),
        gpp(GPP.hyperextensions, 8, 4),
      ],
      // Day 4
      [
        compSlot(DL.blocks, D, [p(60, 3, 1), p(70, 3, 1), p(80, 3, 1), p(85, 2, 2), p(90, 1, 3)]),
        gpp(BP.inclineShoulder, 3, 4),
        gpp(GPP.medialDelts, 6, 4),
        gpp(GPP.reverseHyperextensions, 8, 4),
      ],
    ],
  };

  // ── Week 10 ──
  const w10: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(SQ.competition, S, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 2, 4)]),
        compSlot(BP.competition, B, [p(50, 4, 1), p(60, 3, 1), p(70, 2, 2), p(75, 1, 3)]),
        gpp(GPP.pecs, 6, 4),
        gpp(GPP.medialDelts, 6, 4),
        gpp(GPP.hyperextensions, 6, 4),
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
          p(103, 1, 1),
        ]),
        compSlot(DL.pauseKnees, D, [p(50, 3, 1), p(60, 3, 1), p(70, 2, 2), p(80, 1, 3)]),
        gpp(GPP.lats, 6, 5),
        gpp(GPP.abs, 10, 3),
      ],
      // Day 3
      [
        compSlot(SQ.competition, S, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 3, 4)]),
        compSlot(BP.competition, B, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.frontDelts, 6, 5),
        gpp(GPP.hyperextensions, 8, 4),
      ],
      // Day 4
      [
        compSlot(DL.deficit, D, [p(50, 3, 1), p(60, 3, 1), p(65, 3, 4)]),
        compSlot(BP.speed, B, [p(40, 4, 1), p(45, 4, 1), p(50, 4, 4)]),
        gpp(BP.dumbbell, 6, 5),
        gpp(GPP.legPress, 6, 5),
        gpp(GPP.abs, 8, 3),
      ],
    ],
  };

  // ── Week 11 ──
  const w11: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(SQ.competition, S, [
          p(50, 5, 1),
          p(60, 4, 1),
          p(70, 3, 1),
          p(80, 3, 2),
          p(85, 2, 3),
        ]),
        compSlot(BP.competition, B, [
          p(50, 5, 1),
          p(60, 4, 1),
          p(70, 3, 1),
          p(80, 3, 1),
          p(85, 2, 4),
        ]),
        gpp(GPP.pecs, 8, 5),
        gpp(GPP.tricepsStanding, 6, 5),
        gpp(GPP.hyperextensions, 8, 5),
      ],
      // Day 2
      [
        compSlot(BP.paused3s, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 4)]),
        compSlot(DL.plusBelowKnees, D, [p(50, 1, 1), p(60, 1, 1), p(70, 1, 1), p(75, 1, 4)], '1+3'),
        // NOTE: Source text at Week 11 Day 2 has "100% x 1 x 1, 103% x 1 x 1" lines that
        // appear to be deadlift test attempts carried over from the data — these are unusual
        // mid-program and may be a misparse. Including deadlift-to-knees as secondary exercise.
        compSlot(DL.pauseKnees, D, [p(50, 3, 1), p(60, 3, 1), p(70, 2, 2)]),
        gpp(GPP.lats, 8, 5),
        gpp(GPP.abs, 10, 3),
      ],
      // Day 3
      [
        compSlot(SQ.competition, S, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 2, 4)]),
        compSlot(BP.competition, B, [p(50, 5, 1), p(60, 4, 1), p(70, 3, 1), p(80, 3, 4)]),
        gpp(GPP.pecs, 6, 5),
        gpp(GPP.tricepsStanding, 6, 4),
        gpp(GPP.goodmorning, 5, 4),
      ],
      // Day 4
      [
        compSlot(DL.competition, D, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(BP.inclineShoulder, 3, 4),
        gpp(GPP.frontDelts, 6, 4),
        gpp(GPP.reverseHyperextensions, 6, 4),
      ],
    ],
  };

  // ── Week 12 ──
  const w12: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(BP.competition, B, [p(55, 3, 1), p(65, 3, 1), p(75, 2, 2), p(85, 1, 3)]),
        compSlot(SQ.competition, S, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.pecs, 6, 4),
        gpp(GPP.hyperextensions, 8, 4),
      ],
      // Day 2
      [
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 3, 4)]),
        compSlot(DL.competition, D, [
          p(50, 3, 1),
          p(60, 3, 1),
          p(70, 3, 1),
          p(80, 2, 2),
          p(85, 1, 2),
        ]),
        gpp(BP.dumbbell, 6, 5),
        gpp(GPP.lats, 8, 4),
        gpp(GPP.abs, 10, 3),
      ],
      // Day 3
      [
        compSlot(SQ.competition, S, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.pecs, 6, 4),
        gpp(GPP.goodmorning, 4, 4),
      ],
      // Day 4
      [
        compSlot(DL.plusBelowKnees, D, [p(50, 1, 1), p(60, 1, 1), p(70, 1, 1), p(75, 1, 4)], '1+2'),
        gpp(BP.inclineShoulder, 2, 5),
        gpp(GPP.lats, 6, 4),
        gpp(GPP.abs, 8, 3),
      ],
    ],
  };

  // ── Week 13 ──
  const w13: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(SQ.competition, S, [
          p(50, 3, 1),
          p(60, 3, 1),
          p(70, 3, 1),
          p(80, 2, 2),
          p(85, 1, 2),
        ]),
        compSlot(BP.competition, B, [
          p(50, 3, 1),
          p(60, 3, 1),
          p(70, 3, 1),
          p(80, 2, 2),
          p(85, 1, 2),
        ]),
        gpp(GPP.pecs, 6, 4),
        gpp(GPP.tricepsStanding, 6, 4),
        gpp(GPP.goodmorningSeat, 4, 4),
      ],
      // Day 2
      [
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        compSlot(DL.competition, D, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.lats, 6, 4),
        gpp(GPP.abs, 10, 3),
      ],
      // Day 3
      [
        compSlot(SQ.competition, S, [
          p(50, 3, 1),
          p(60, 3, 1),
          p(70, 3, 1),
          p(75, 2, 1),
          p(80, 1, 2),
        ]),
        compSlot(BP.competition, B, [
          p(50, 3, 1),
          p(60, 3, 1),
          p(70, 3, 1),
          p(75, 2, 1),
          p(80, 1, 3),
        ]),
        gpp(GPP.pecs, 8, 4),
        gpp(GPP.abs, 8, 3),
      ],
      // Day 4
      [
        compSlot(BP.speed, B, [p(40, 4, 1), p(45, 4, 1), p(50, 4, 3)]),
        gpp(GPP.pecs, 6, 4),
        gpp(GPP.hyperextensions, 8, 4),
      ],
    ],
  };

  // ── Week 14 ──
  const w14: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(DL.competition, D, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 2, 3)]),
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 2, 3)]),
        gpp(GPP.pecs, 6, 4),
        gpp(GPP.abs, 10, 3),
      ],
      // Day 2 — SQUAT + BENCH TEST
      [
        compSlot(SQ.competition, S, [
          p(50, 3, 1),
          p(60, 3, 1),
          p(70, 3, 2),
          p(80, 2, 1),
          p(90, 1, 1),
          p(95, 1, 1),
          p(100, 1, 1),
        ]),
        compSlot(BP.competition, B, [
          p(50, 3, 1),
          p(60, 3, 1),
          p(70, 3, 1),
          p(80, 2, 1),
          p(85, 1, 1),
          p(90, 1, 2),
          p(95, 1, 1),
          p(100, 1, 1),
        ]),
        gpp(GPP.lats, 8, 4),
        gpp(GPP.hyperextensions, 5, 4),
      ],
      // Day 3 — DEADLIFT TEST
      [
        compSlot(DL.competition, D, [
          p(50, 3, 1),
          p(60, 3, 1),
          p(70, 3, 1),
          p(80, 2, 1),
          p(90, 1, 1),
          p(95, 1, 1),
          p(100, 1, 1),
        ]),
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(75, 3, 4)]),
        gpp(GPP.pecs, 8, 4),
        gpp(GPP.abs, 8, 3),
      ],
      // Day 4
      [gpp(BP.inclineShoulder, 3, 5), gpp(GPP.pecs, 6, 4), gpp(GPP.hyperextensions, 8, 4)],
    ],
  };

  // ── Week 15 ──
  const w15: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(SQ.competition, S, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 3, 1), p(80, 2, 4)]),
        gpp(GPP.pecs, 6, 3),
        gpp(GPP.goodmorning, 4, 4),
      ],
      // Day 2
      [
        compSlot(BP.competition, B, [
          p(50, 3, 1),
          p(60, 3, 1),
          p(70, 3, 1),
          p(75, 2, 1),
          p(80, 1, 3),
        ]),
        compSlot(DL.competition, D, [p(50, 3, 1), p(60, 3, 1), p(70, 2, 1), p(75, 1, 3)]),
        gpp(GPP.lats, 6, 4),
        gpp(GPP.abs, 8, 3),
      ],
      // Day 3
      [
        compSlot(SQ.competition, S, [p(50, 3, 1), p(60, 3, 1), p(70, 2, 2), p(75, 1, 3)]),
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 2, 1), p(75, 1, 3)]),
        gpp(GPP.hyperextensions, 6, 3),
      ],
      // Day 4 — REST
      [],
    ],
  };

  // ── Week 16 ──
  const w16: SheikoWeekPlan = {
    days: [
      // Day 1
      [
        compSlot(SQ.competition, S, [p(50, 3, 1), p(60, 3, 1), p(70, 2, 3)]),
        compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 1), p(70, 2, 2), p(75, 1, 3)]),
        gpp(GPP.abs, 8, 3),
      ],
      // Day 2
      [compSlot(BP.competition, B, [p(50, 3, 1), p(60, 3, 2), p(70, 2, 3)])],
      // Days 3-4: REST + COMPETITION
      [],
      [],
    ],
  };

  return [w1, w2, w3, w4, w5, w6, w7, w8, w9, w10, w11, w12, w13, w14, w15, w16];
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
    id: 'sheiko-7-2',
    name: 'Sheiko 7.2 — Press Banca',
    description:
      'Programa Sheiko de 16 semanas con enfasis en press banca. ' +
      'Tres levantamientos de competicion con mayor volumen de press banca. ' +
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
    configFields: SHEIKO_1RM_CONFIG_FIELDS,
    weightIncrements,
    displayMode: 'flat',
    ...SHEIKO_1RM_CONFIG_STRINGS,
  };
}

export const SHEIKO_7_2_DEFINITION = buildDefinition();
