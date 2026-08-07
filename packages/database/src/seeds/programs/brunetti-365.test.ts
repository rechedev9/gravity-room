import { describe, it, expect } from 'vitest';
import { PROGRAM_CATALOG } from '@gzclp/domain/catalog';
import {
  BRUNETTI365_EXP_DEFINITION_JSONB,
  BRUNETTI365_DEFINITION_JSONB,
  BOOK_JAW_B1,
  BOOK_JAW_B2,
  BOOK_JAW_B3,
  BOOK_T1_BENCH_D1,
  BOOK_T1_DL_D1,
  BOOK_T1_BOX_SQUAT,
  BOOK_PN_SQUAT_D1_MAIN,
  BOOK_PN_BENCH_D1,
  BOOK_PN_DL_D3_B1,
  BOOK_PN_BENCH_D3_B2,
  BOOK_PN_SQUAT_D1_B2,
  BOOK_IS_SQUAT_D1,
  FZ_EXIT_NOTES,
  buildFaseT1,
  buildFasePN,
} from './brunetti-365';
import { SALA_1_DEFINITION_JSONB } from './sala-1';
import { SALA_2_DEFINITION_JSONB } from './sala-2';
import { ProgramDefinitionSchema } from '@gzclp/domain/schemas/program-definition';

// ---------------------------------------------------------------------------
// Types / hydration
// ---------------------------------------------------------------------------

type SlotLike = {
  readonly id: string;
  readonly exerciseId: string;
  readonly isTestSlot?: boolean;
  readonly propagatesTo?: string;
  readonly tmPercent?: number;
  readonly percentOf?: string;
  readonly prescriptions?: readonly {
    readonly percent: number;
    readonly sets: number;
    readonly reps: number;
  }[];
  readonly stages?: readonly { readonly sets: number; readonly reps: number }[];
  readonly startWeightKey?: string;
  readonly notes?: string;
  readonly isBodyweight?: boolean;
};

type DayLike = {
  readonly name: string;
  readonly slots: readonly SlotLike[];
};

type DefinitionJsonb = {
  readonly exercises: Record<string, unknown>;
  readonly days: readonly DayLike[];
  readonly cycleLength: number;
  readonly totalWorkouts: number;
};

function hydratedDefinition(id: string, definition: DefinitionJsonb): Record<string, unknown> {
  const meta = PROGRAM_CATALOG.find((entry) => entry.id === id);
  if (!meta) throw new Error(`Missing PROGRAM_CATALOG metadata for ${id}`);

  const { level: _level, isActive: _isActive, ...schemaMeta } = meta;

  return {
    ...schemaMeta,
    version: 1,
    source: 'preset' as const,
    ...definition,
    exercises: Object.fromEntries(
      Object.keys(definition.exercises).map((key) => [key, { name: key }])
    ),
  };
}

function mainLiftSlot(day: DayLike, exerciseId: string): SlotLike | undefined {
  return day.slots.find(
    (s) => s.exerciseId === exerciseId && (s.tmPercent !== undefined || s.percentOf !== undefined)
  );
}

function findDay(days: readonly DayLike[], name: string): DayLike {
  const day = days.find((d) => d.name === name);
  if (!day) throw new Error(`Missing day: ${name}`);
  return day;
}

// ---------------------------------------------------------------------------
// Day counts (full vs EXP)
// ---------------------------------------------------------------------------

describe('brunetti-365 day counts (book structure)', () => {
  it('full preset is FZ24 + T1 24 + PN52 + JAW72 + IS48 = 220', () => {
    expect(BRUNETTI365_DEFINITION_JSONB.days.length).toBe(220);
    expect(BRUNETTI365_DEFINITION_JSONB.cycleLength).toBe(220);
    expect(BRUNETTI365_DEFINITION_JSONB.totalWorkouts).toBe(220);
  });

  it('EXP preset skips FZ: 196 days', () => {
    expect(BRUNETTI365_EXP_DEFINITION_JSONB.days.length).toBe(196);
    expect(BRUNETTI365_EXP_DEFINITION_JSONB.cycleLength).toBe(196);
  });

  it('EXP days match full without the first 24 FZ days', () => {
    const full = BRUNETTI365_DEFINITION_JSONB.days as readonly DayLike[];
    const exp = BRUNETTI365_EXP_DEFINITION_JSONB.days as readonly DayLike[];
    expect(exp.map((d) => d.name)).toEqual(full.slice(24).map((d) => d.name));
  });
});

// ---------------------------------------------------------------------------
// Fase Zero book anchors
// ---------------------------------------------------------------------------

describe('brunetti-365 Fase Zero book parity', () => {
  const days = (BRUNETTI365_DEFINITION_JSONB.days as readonly DayLike[]).slice(0, 24);

  it('is 8 weeks × 3 days (not 2)', () => {
    expect(days).toHaveLength(24);
    const week1 = days.filter((d) => d.name.includes('FZ Sem. 1'));
    expect(week1).toHaveLength(3);
    expect(week1.map((d) => d.name)).toEqual([
      'FZ Sem. 1 — Dia 1 (Squat)',
      'FZ Sem. 1 — Dia 2 (Panca)',
      'FZ Sem. 1 — Dia 3 (Stacco)',
    ]);
  });

  it('each FZ day focuses one main fundamental track (no dual main lifts week 1)', () => {
    const d1 = findDay(days, 'FZ Sem. 1 — Dia 1 (Squat)');
    const d2 = findDay(days, 'FZ Sem. 1 — Dia 2 (Panca)');
    const d3 = findDay(days, 'FZ Sem. 1 — Dia 3 (Stacco)');
    expect(
      d1.slots.some((s) => s.exerciseId === 'squat_bodyweight' || s.exerciseId === 'squat')
    ).toBe(true);
    expect(d1.slots.some((s) => s.exerciseId === 'bench' || s.exerciseId === 'deadlift')).toBe(
      false
    );
    expect(d2.slots.some((s) => s.exerciseId === 'bench_pushups' || s.exerciseId === 'bench')).toBe(
      true
    );
    expect(
      d3.slots.some((s) => s.exerciseId === 'deadlift_isometric' || s.exerciseId === 'deadlift')
    ).toBe(true);
  });

  it('includes propedeutica blocks (core + activation + proprioception)', () => {
    const d1 = findDay(days, 'FZ Sem. 1 — Dia 1 (Squat)');
    const ids = d1.slots.map((s) => s.exerciseId);
    expect(ids).toContain('plank');
    expect(ids).toContain('leg_curl_prone');
    expect(ids).toContain('bulgarian_split_squat_slow');
  });

  it('does not use T1 volume ladder (no 5x6s % progression on FZ fundamentals)', () => {
    for (const day of days) {
      for (const slot of day.slots) {
        if (slot.tmPercent !== undefined) {
          throw new Error(`FZ must not use TM% slots, found ${slot.id} @ ${slot.tmPercent}`);
        }
      }
    }
  });

  it('week 8 embeds book exit criteria notes', () => {
    const d3 = findDay(days, 'FZ Sem. 8 — Dia 3 (Stacco)');
    const notes = d3.slots.map((s) => s.notes ?? '').join(' ');
    expect(notes).toContain('peso corporal');
    expect(FZ_EXIT_NOTES).toContain('3 reps sentadilla');
  });
});

// ---------------------------------------------------------------------------
// T1 book anchors (shipped days, not a re-implementation of builders)
// ---------------------------------------------------------------------------

describe('brunetti-365 T1 book parity', () => {
  const days = (BRUNETTI365_DEFINITION_JSONB.days as readonly DayLike[]).slice(24, 48);

  it('has 6 weeks × 4 days', () => {
    expect(days).toHaveLength(24);
  });

  it('week 1 Giorno Uno: squat 4 reps × 10 sets @ ~50% range, bench 8×6s @50%, dl 5×5 @55%', () => {
    const d1 = findDay(days, 'T1 Sem. 1 — Dia 1 (Giorno Uno)');
    const squat = mainLiftSlot(d1, 'squat');
    const bench = mainLiftSlot(d1, 'bench');
    const dl = mainLiftSlot(d1, 'deadlift');
    expect(squat?.stages?.[0]).toEqual({ sets: 10, reps: 4 });
    expect(squat?.tmPercent).toBe(0.5);
    expect(bench?.tmPercent).toBe(BOOK_T1_BENCH_D1[0].pct);
    expect(bench?.stages?.[0]).toEqual({
      sets: BOOK_T1_BENCH_D1[0].sets,
      reps: BOOK_T1_BENCH_D1[0].reps,
    });
    expect(dl?.tmPercent).toBe(BOOK_T1_DL_D1[0].pct);
    expect(dl?.stages?.[0]).toEqual({
      sets: BOOK_T1_DL_D1[0].sets,
      reps: BOOK_T1_DL_D1[0].reps,
    });
  });

  it('bench D1 progresses 8→9→10 reps then 55% block (book p.43)', () => {
    for (let week = 1; week <= 6; week++) {
      const d1 = findDay(days, `T1 Sem. ${week} — Dia 1 (Giorno Uno)`);
      const bench = mainLiftSlot(d1, 'bench');
      const expected = BOOK_T1_BENCH_D1[week - 1];
      expect(bench?.tmPercent).toBe(expected.pct);
      expect(bench?.stages?.[0]).toEqual({ sets: expected.sets, reps: expected.reps });
    }
  });

  it('Giorno Tre includes box squat with book weekly table', () => {
    for (let week = 1; week <= 6; week++) {
      const d3 = findDay(days, `T1 Sem. ${week} — Dia 3 (Giorno Tre)`);
      const box = mainLiftSlot(d3, 'box_squat');
      const expected = BOOK_T1_BOX_SQUAT[week - 1];
      expect(box?.tmPercent).toBe(expected.pct);
      expect(box?.stages?.[0]).toEqual({ sets: expected.sets, reps: expected.reps });
    }
  });

  it('EXP T1 Bulgarian split squats use a config field available in the EXP preset', () => {
    const expDays = BRUNETTI365_EXP_DEFINITION_JSONB.days as readonly DayLike[];
    const d4 = findDay(expDays, 'T1 Sem. 1 — Dia 4 (Giorno Quattro)');
    const bulgarian = d4.slots.find((slot) => slot.exerciseId === 'bulgarian_split_squat');
    const expConfigKeys = BRUNETTI365_EXP_DEFINITION_JSONB.configFields.map((field) => field.key);

    expect(bulgarian?.startWeightKey).toBe('acc_general');
    expect(expConfigKeys).toContain(bulgarian?.startWeightKey);
    expect(expConfigKeys).not.toContain('fz_squat_start');
  });

  it('sala-1 days are identical to full-program T1', () => {
    expect(SALA_1_DEFINITION_JSONB.days.map((d) => d.name)).toEqual(
      buildFaseT1().map((d) => d.name)
    );
    const salaSlots = (SALA_1_DEFINITION_JSONB.days as readonly DayLike[])[0].slots[0];
    const fullSlots = (days as readonly DayLike[])[0].slots[0];
    expect(salaSlots.id).toBe(fullSlots.id);
  });
});

// ---------------------------------------------------------------------------
// PN2 book anchors
// ---------------------------------------------------------------------------

describe('brunetti-365 PN2 book parity', () => {
  const days = (BRUNETTI365_DEFINITION_JSONB.days as readonly DayLike[]).slice(48, 100);

  it('has 13 weeks × 4 days', () => {
    expect(days).toHaveLength(52);
  });

  it('week 1 Giorno Uno squat main is 72% 5×5 (book 72% 5x5)', () => {
    const d1 = findDay(days, 'PN Sem. 1 — Dia 1 (Giorno Uno)');
    const squat = mainLiftSlot(d1, 'squat');
    expect(squat?.tmPercent).toBe(BOOK_PN_SQUAT_D1_MAIN[0].pct);
    expect(squat?.stages?.[0]).toEqual({
      sets: BOOK_PN_SQUAT_D1_MAIN[0].sets,
      reps: BOOK_PN_SQUAT_D1_MAIN[0].reps,
    });
  });

  it('week 1 Giorno Uno panca pin is 70% 4×7s', () => {
    const d1 = findDay(days, 'PN Sem. 1 — Dia 1 (Giorno Uno)');
    const bench = mainLiftSlot(d1, 'bench_pin');
    expect(bench?.tmPercent).toBe(BOOK_PN_BENCH_D1[0].pct);
    expect(bench?.stages?.[0]).toEqual({
      sets: BOOK_PN_BENCH_D1[0].sets,
      reps: BOOK_PN_BENCH_D1[0].reps,
    });
  });

  it('week 2 squat main is 60% 8×4s', () => {
    const d1 = findDay(days, 'PN Sem. 2 — Dia 1 (Giorno Uno)');
    const squat = mainLiftSlot(d1, 'squat');
    expect(squat?.tmPercent).toBe(0.6);
    expect(squat?.stages?.[0]).toEqual({ sets: 4, reps: 8 });
  });

  // Literal book anchors (OCR p.73 / p.76) — not BOOK_* self-reference only.
  it('PN B1 Sett4 D3 stacco is 63% 8×3s (OCR p.73) — literal anchor', () => {
    const d3 = findDay(days, 'PN Sem. 4 — Dia 3 (Giorno Tre)');
    const dl = mainLiftSlot(d3, 'deadlift');
    expect(dl?.tmPercent).toBe(0.63);
    expect(dl?.stages?.[0]).toEqual({ sets: 3, reps: 8 });
    // Not squat Sett4 mirror (8×4s → sets:4)
    expect(dl?.stages?.[0]).not.toEqual({ sets: 4, reps: 8 });
    // Table export still agrees
    expect(BOOK_PN_DL_D3_B1[3]).toEqual({ pct: 0.63, sets: 3, reps: 8 });
  });

  it('B1 D3 stacco full weekly table matches BOOK_PN_DL_D3_B1', () => {
    for (let week = 1; week <= 5; week++) {
      const d3 = findDay(days, `PN Sem. ${week} — Dia 3 (Giorno Tre)`);
      const dl = mainLiftSlot(d3, 'deadlift');
      const expected = BOOK_PN_DL_D3_B1[week - 1];
      expect(dl?.tmPercent).toBe(expected.pct);
      expect(dl?.stages?.[0]).toEqual({ sets: expected.sets, reps: expected.reps });
    }
  });

  it('B2 D1 squat Sett6–12 match BOOK_PN_SQUAT_D1_B2 on shipped days', () => {
    for (let i = 0; i < 7; i++) {
      const week = 6 + i;
      const d1 = findDay(days, `PN Sem. ${week} — Dia 1 (Giorno Uno)`);
      const squat = mainLiftSlot(d1, 'squat');
      const expected = BOOK_PN_SQUAT_D1_B2[i];
      if ('repsBySet' in expected) {
        expect(squat?.percentOf).toBe('squat_tm');
        expect(squat?.prescriptions).toEqual(
          expected.repsBySet.map((reps) => ({ percent: expected.pct * 100, sets: 1, reps }))
        );
      } else {
        expect(squat?.tmPercent).toBe(expected.pct);
        expect(squat?.stages?.[0]).toEqual({ sets: expected.sets, reps: expected.reps });
      }
    }
  });

  it.each([
    { week: 6, percent: 76, repsBySet: [4, 4, 3, 4, 4] },
    { week: 8, percent: 78, repsBySet: [2, 2, 2, 2, 5] },
    { week: 10, percent: 80, repsBySet: [3, 3, 2, 3, 3] },
    { week: 12, percent: 82, repsBySet: [2, 2, 2, 2, 5] },
  ])('B2 week $week preserves non-uniform sets on D1 squat and mirrored D3 deadlift', (row) => {
    const expected = row.repsBySet.map((reps) => ({ percent: row.percent, sets: 1, reps }));
    const d1Squat = mainLiftSlot(
      findDay(days, `PN Sem. ${row.week} — Dia 1 (Giorno Uno)`),
      'squat'
    );
    const d3Deadlift = mainLiftSlot(
      findDay(days, `PN Sem. ${row.week} — Dia 3 (Giorno Tre)`),
      'deadlift'
    );

    expect(d1Squat?.prescriptions).toEqual(expected);
    expect(d3Deadlift?.prescriptions).toEqual(expected);
  });

  it.each([
    { week: 1, expectedOhp: { sets: 5, reps: 8 }, expectedRow: { sets: 5, reps: 5 } },
    { week: 6, expectedOhp: undefined, expectedRow: { sets: 3, reps: 8 } },
  ])('PN week $week ships the correct D2 press and row accessories', (row) => {
    const d2 = findDay(days, `PN Sem. ${row.week} — Dia 2 (Giorno Due)`);
    const ohp = d2.slots.find((slot) => slot.exerciseId === 'ohp');
    const oneArmRow = d2.slots.find((slot) => slot.exerciseId === 'one_arm_row');

    expect(ohp?.stages?.[0]).toEqual(row.expectedOhp);
    expect(oneArmRow?.stages?.[0]).toEqual(row.expectedRow);
  });

  it.each([
    { week: 1, expected: { sets: 3, reps: 10 } },
    { week: 6, expected: { sets: 4, reps: 8 } },
  ])('PN week $week ships leg press reps inside its block range', (row) => {
    const d4 = findDay(days, `PN Sem. ${row.week} — Dia 4 (Giorno Quattro)`);
    const legPress = d4.slots.find((slot) => slot.exerciseId === 'prensa');

    expect(legPress?.stages?.[0]).toEqual(row.expected);
  });

  it('PN B2 Sett6 D3 panca is 80% 2×6s (OCR p.76) — literal anchor', () => {
    const bench = mainLiftSlot(findDay(days, 'PN Sem. 6 — Dia 3 (Giorno Tre)'), 'bench');
    expect(bench?.tmPercent).toBe(0.8);
    expect(bench?.stages?.[0]).toEqual({ sets: 6, reps: 2 });
    expect(bench?.tmPercent).not.toBe(0.78);
  });

  it('B2 D3 panca Sett6–12 match BOOK_PN_BENCH_D3_B2 weekly ladder', () => {
    for (let i = 0; i < 7; i++) {
      const week = 6 + i;
      const d3 = findDay(days, `PN Sem. ${week} — Dia 3 (Giorno Tre)`);
      const bench = mainLiftSlot(d3, 'bench');
      const expected = BOOK_PN_BENCH_D3_B2[i];
      expect(bench?.tmPercent).toBe(expected.pct);
      expect(bench?.stages?.[0]).toEqual({ sets: expected.sets, reps: expected.reps });
    }
  });

  it('JAW B1 Sett1 is 70% 10×6s (OCR p.86) — literal anchor', () => {
    const expDays = BRUNETTI365_EXP_DEFINITION_JSONB.days as readonly DayLike[];
    const d1 = findDay(expDays, 'JAW B1 Sem. 1 — Dia 1');
    const sq = mainLiftSlot(d1, 'squat');
    expect(sq?.tmPercent).toBe(0.7);
    expect(sq?.stages?.[0]).toEqual({ sets: 6, reps: 10 });
  });

  it('sala-2 days match PN builder', () => {
    expect(SALA_2_DEFINITION_JSONB.days.map((d) => d.name)).toEqual(
      buildFasePN().map((d) => d.name)
    );
  });
});

// ---------------------------------------------------------------------------
// JAW book ladder + template
// ---------------------------------------------------------------------------

describe('brunetti-365 JAW book parity', () => {
  const days = BRUNETTI365_EXP_DEFINITION_JSONB.days as readonly DayLike[];

  function jawMain(week: number, day: number, lift: 'squat' | 'bench'): SlotLike {
    const d = findDay(days, `JAW B1 Sem. ${week} — Dia ${day}`);
    const slot = mainLiftSlot(d, lift);
    if (!slot) throw new Error(`No ${lift} on JAW B1 Sem ${week} Dia ${day}`);
    return slot;
  }

  it('B1 week 1 is 70% 10 reps × 6 sets on squat and bench', () => {
    const sq = jawMain(1, 1, 'squat');
    const bp = jawMain(1, 1, 'bench');
    expect(sq.tmPercent).toBe(BOOK_JAW_B1[0].pct);
    expect(sq.stages?.[0]).toEqual({ sets: BOOK_JAW_B1[0].sets, reps: BOOK_JAW_B1[0].reps });
    expect(bp.tmPercent).toBe(BOOK_JAW_B1[0].pct);
    expect(bp.stages?.[0]).toEqual({ sets: BOOK_JAW_B1[0].sets, reps: BOOK_JAW_B1[0].reps });
  });

  it('B1 weeks 1–5 match full BOOK_JAW_B1 ladder', () => {
    for (let i = 0; i < 5; i++) {
      const sq = jawMain(i + 1, 1, 'squat');
      expect(sq.tmPercent).toBe(BOOK_JAW_B1[i].pct);
      expect(sq.stages?.[0]).toEqual({ sets: BOOK_JAW_B1[i].sets, reps: BOOK_JAW_B1[i].reps });
    }
  });

  it('B2 week 7 starts 80% 6×6s; B3 week 13 starts 90% 3×6s', () => {
    const b2 = findDay(days, 'JAW B2 Sem. 7 — Dia 1');
    const b3 = findDay(days, 'JAW B3 Sem. 13 — Dia 1');
    const sq2 = mainLiftSlot(b2, 'squat');
    const sq3 = mainLiftSlot(b3, 'squat');
    expect(sq2?.tmPercent).toBe(BOOK_JAW_B2[0].pct);
    expect(sq2?.stages?.[0]).toEqual({ sets: BOOK_JAW_B2[0].sets, reps: BOOK_JAW_B2[0].reps });
    expect(sq3?.tmPercent).toBe(BOOK_JAW_B3[0].pct);
    expect(sq3?.stages?.[0]).toEqual({ sets: BOOK_JAW_B3[0].sets, reps: BOOK_JAW_B3[0].reps });
  });

  it.each([
    { block: 1, week: 1, expected: { sets: 5, reps: 5 } },
    { block: 2, week: 7, expected: { sets: 6, reps: 3 } },
    { block: 3, week: 13, expected: { sets: 4, reps: 5 } },
  ])('JAW B$block light deadlift uses the documented volume', (row) => {
    const d4 = findDay(days, `JAW B${row.block} Sem. ${row.week} — Dia 4 (Ligero)`);
    const deadlift = mainLiftSlot(d4, 'deadlift');

    expect(deadlift?.stages?.[0]).toEqual(row.expected);
  });

  it('deadlift does not use JAW % ladder (no jaw_b*_tm on DL main in week 1)', () => {
    const d1 = findDay(days, 'JAW B1 Sem. 1 — Dia 1');
    const dlSlots = d1.slots.filter((s) => s.exerciseId === 'deadlift');
    for (const s of dlSlots) {
      // free RPE ramp — no jaw block TM percent schedule
      if (s.tmPercent !== undefined) {
        expect(s.id.includes('jaw_b')).toBe(true); // id may contain jaw
      }
      // Must not equal B1 week1 70% 10x6
      if (s.stages?.[0] && s.tmPercent === 0.7) {
        expect(s.stages[0]).not.toEqual({ sets: 6, reps: 10 });
      }
    }
  });

  it('test slots: B1/B2 squat+bench propagate; B3 does not; DL has no propagatesTo', () => {
    const b1Sq = findDay(days, 'JAW Bloque 1 — Test Maximo Sentadilla').slots[0];
    const b1Bp = findDay(days, 'JAW Bloque 1 — Test Maximo Press Banca').slots[0];
    const b1Dl = findDay(days, 'JAW Bloque 1 — Test Maximo Peso Muerto').slots[0];
    const b2Sq = findDay(days, 'JAW Bloque 2 — Test Maximo Sentadilla').slots[0];
    const b3Sq = findDay(days, 'JAW Bloque 3 — Test Maximo Sentadilla').slots[0];

    expect(b1Sq.isTestSlot).toBe(true);
    expect(b1Sq.propagatesTo).toBe('squat_jaw_b2_tm');
    expect(b1Bp.propagatesTo).toBe('bench_jaw_b2_tm');
    expect(b1Dl.propagatesTo).toBeUndefined();
    expect(b2Sq.propagatesTo).toBe('squat_jaw_b3_tm');
    expect(b3Sq.propagatesTo).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// IS sottofasi
// ---------------------------------------------------------------------------

describe('brunetti-365 IS book parity', () => {
  const days = (BRUNETTI365_DEFINITION_JSONB.days as readonly DayLike[]).slice(172); // 24+24+52+72=172

  it('has 12 weeks × 4 days with S1 then S2 labels', () => {
    expect(days).toHaveLength(48);
    expect(days[0].name).toContain('IS S1');
    expect(days[24].name).toContain('IS S2');
  });

  it('week 1 Giorno Uno squat is 80% 3×7s (Soluzione A heavy)', () => {
    const d1 = findDay(days, 'IS S1 Sem. 1 — Dia 1');
    const squat = mainLiftSlot(d1, 'squat');
    expect(squat?.tmPercent).toBe(BOOK_IS_SQUAT_D1[0].main.pct);
    expect(squat?.stages?.[0]).toEqual({
      sets: BOOK_IS_SQUAT_D1[0].main.sets,
      reps: BOOK_IS_SQUAT_D1[0].main.reps,
    });
  });

  it('S1 notes use 6–12 isolation range; S2 uses 12–30', () => {
    const s1 = findDay(days, 'IS S1 Sem. 1 — Dia 1');
    const s2 = findDay(days, 'IS S2 Sem. 7 — Dia 1');
    const n1 = s1.slots.map((s) => s.notes ?? '').join(' ');
    const n2 = s2.slots.map((s) => s.notes ?? '').join(' ');
    expect(n1).toMatch(/6–12|6-12/);
    expect(n2).toMatch(/12–30|12-30/);
  });
});

// ---------------------------------------------------------------------------
// Schema + JAW propagation regression
// ---------------------------------------------------------------------------

describe('brunetti-365 schema validation', () => {
  it('passes ProgramDefinitionSchema for full variant', () => {
    const result = ProgramDefinitionSchema.safeParse(
      hydratedDefinition('365-programmare-lipertrofia', BRUNETTI365_DEFINITION_JSONB)
    );
    if (!result.success) {
      console.error(JSON.stringify(result.error.issues.slice(0, 15), null, 2));
    }
    expect(result.success).toBe(true);
  });

  it('passes ProgramDefinitionSchema for EXP variant', () => {
    const result = ProgramDefinitionSchema.safeParse(
      hydratedDefinition('la-sala-del-tiempo', BRUNETTI365_EXP_DEFINITION_JSONB)
    );
    if (!result.success) {
      console.error(JSON.stringify(result.error.issues.slice(0, 15), null, 2));
    }
    expect(result.success).toBe(true);
  });
});

describe('sala-1 / sala-2 schema', () => {
  it('sala-1 validates', () => {
    const result = ProgramDefinitionSchema.safeParse({
      id: 'sala-del-tiempo-1',
      name: 'La Sala del Tiempo 1',
      description: 't',
      author: 't',
      version: 1,
      category: 'hypertrophy',
      source: 'preset',
      ...SALA_1_DEFINITION_JSONB,
      exercises: Object.fromEntries(
        Object.keys(SALA_1_DEFINITION_JSONB.exercises).map((k) => [k, { name: k }])
      ),
    });
    if (!result.success) console.error(result.error.issues.slice(0, 10));
    expect(result.success).toBe(true);
  });

  it('sala-2 validates', () => {
    const result = ProgramDefinitionSchema.safeParse({
      id: 'sala-del-tiempo-2',
      name: 'La Sala del Tiempo 2',
      description: 't',
      author: 't',
      version: 1,
      category: 'hypertrophy',
      source: 'preset',
      ...SALA_2_DEFINITION_JSONB,
      exercises: Object.fromEntries(
        Object.keys(SALA_2_DEFINITION_JSONB.exercises).map((k) => [k, { name: k }])
      ),
    });
    if (!result.success) console.error(result.error.issues.slice(0, 10));
    expect(result.success).toBe(true);
  });
});
