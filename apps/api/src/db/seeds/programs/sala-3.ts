// sala-3.ts — "La Sala del Tiempo 3" (Fase Tre: Protocolo JAW Mod)
// 72 workouts, 18 weeks × 4 days/week, 3 blocks × 6 weeks each
//
// JAW Mod starts each block 10% LOWER than original JAW:
//   Block 1: 60-66% (deload 70%)  |  Block 2: 70-76% (deload 80%)  |  Block 3: 80-86% (deload 90%)
// Bench uses 8 reps in B1 (vs 10 for squat/deadlift).
// Test weeks (6, 12, 18): ramping to heavy singles/doubles without grinding.

import type { ProgramDay, SlotDef } from './shared';
import { BRUNETTI_JAW_TM, REST_6MIN, tmNcSlot, flatNcSlot, maxTestSlot } from './shared';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

// ── TM Key Alias ──
const JAW_TM = BRUNETTI_JAW_TM;

// ── Accessory Weight Keys ──
const ACC = {
  INCLINE_DB: 'acc_incline_db_press',
  SEAL_ROW: 'acc_seal_row',
  ONE_ARM_ROW: 'acc_one_arm_row',
} as const;

// ═══════════════════════════════════════════════════════════════════════
// JAW MOD SCHEDULE CONSTANTS (-10% starting loads vs original JAW)
// ═══════════════════════════════════════════════════════════════════════

/** Block 1 squat/deadlift: 60-66% training + 70% deload (original JAW B1 = 70-76%). */
const JAW_MOD_B1_SCHEDULE = [
  { pct: 0.6, sets: 10, reps: 6 }, // Week 1
  { pct: 0.62, sets: 10, reps: 5 }, // Week 2
  { pct: 0.64, sets: 10, reps: 4 }, // Week 3
  { pct: 0.66, sets: 10, reps: 3 }, // Week 4
  { pct: 0.7, sets: 5, reps: 4 }, // Week 5 (deload)
] as const;

/** Block 1 bench: 8 reps instead of 10 (author recommendation for first-timers, p.125). */
const JAW_MOD_B1_BENCH_SCHEDULE = [
  { pct: 0.6, sets: 10, reps: 8 }, // Week 1  (bench: 8 reps, not 10)
  { pct: 0.62, sets: 10, reps: 8 }, // Week 2
  { pct: 0.64, sets: 10, reps: 8 }, // Week 3
  { pct: 0.66, sets: 10, reps: 8 }, // Week 4
  { pct: 0.7, sets: 5, reps: 4 }, // Week 5 (deload — same as squat)
] as const;

/** Block 2: 70-76% training + 80% deload (original JAW B2 = 80-86%). */
const JAW_MOD_B2_SCHEDULE = [
  { pct: 0.7, sets: 6, reps: 6 }, // Week 7
  { pct: 0.72, sets: 6, reps: 5 }, // Week 8
  { pct: 0.74, sets: 6, reps: 4 }, // Week 9
  { pct: 0.76, sets: 6, reps: 3 }, // Week 10
  { pct: 0.8, sets: 3, reps: 5 }, // Week 11 (deload)
] as const;

/** Block 3: 80-86% training + 90% deload (original JAW B3 = 90-96%). */
const JAW_MOD_B3_SCHEDULE = [
  { pct: 0.8, sets: 3, reps: 6 }, // Week 13
  { pct: 0.82, sets: 3, reps: 5 }, // Week 14
  { pct: 0.84, sets: 3, reps: 4 }, // Week 15
  { pct: 0.86, sets: 3, reps: 3 }, // Week 16
  { pct: 0.9, sets: 2, reps: 3 }, // Week 17 (deload)
] as const;

// ═══════════════════════════════════════════════════════════════════════
// PHASE BUILDER — JAW Mod (3 blocks × 6 weeks × 4 days = 72 days)
// ═══════════════════════════════════════════════════════════════════════

/** Block TM key set (one key per lift). */
type BlockTmKeys = {
  readonly SQUAT: string;
  readonly BENCH: string;
  readonly DEADLIFT: string;
};

function buildBlock(
  schedule: readonly { readonly pct: number; readonly sets: number; readonly reps: number }[],
  benchSchedule: readonly { readonly pct: number; readonly sets: number; readonly reps: number }[],
  tmKeys: BlockTmKeys,
  blockNum: number,
  weekStart: number,
  nextBlockTmKeys: {
    readonly squat: string | undefined;
    readonly bench: string | undefined;
    readonly deadlift: string | undefined;
  },
  nextBlockLabels: {
    readonly squat: string;
    readonly bench: string;
    readonly deadlift: string;
  }
): ProgramDay[] {
  const days: ProgramDay[] = [];

  // Deadlift ramping % for Day 1/2 (lighter than main JAW work)
  const dlRampPct = blockNum === 1 ? 0.55 : blockNum === 2 ? 0.6 : 0.65;

  // 5 training weeks
  for (let localWeek = 0; localWeek < 5; localWeek++) {
    const globalWeek = weekStart + localWeek;
    const sqEntry = schedule[localWeek];
    const benchEntry = benchSchedule[localWeek];
    const pctLabel = `${(sqEntry.pct * 100).toFixed(1)}%`;
    const benchPctLabel = `${(benchEntry.pct * 100).toFixed(1)}%`;

    // Day 1: Squat JAW + Bench JAW + Deadlift ramping + Rear delt
    days.push({
      name: `JAW Mod B${blockNum} Sem. ${globalWeek} — Dia 1`,
      slots: [
        tmNcSlot(
          `jaw_b${blockNum}_squat_d1_w${globalWeek}`,
          'squat',
          tmKeys.SQUAT,
          sqEntry.pct,
          sqEntry.sets,
          sqEntry.reps,
          'main',
          `JAW Mod Bloque ${blockNum}, Semana ${globalWeek}. ${pctLabel} TM. ${REST_6MIN}`
        ),
        tmNcSlot(
          `jaw_b${blockNum}_bench_d1_w${globalWeek}`,
          'bench',
          tmKeys.BENCH,
          benchEntry.pct,
          benchEntry.sets,
          benchEntry.reps,
          'main',
          `JAW Mod Bloque ${blockNum}, Semana ${globalWeek}. ${benchPctLabel} TM. ${REST_6MIN}`
        ),
        tmNcSlot(
          `jaw_b${blockNum}_dl_ramp_d1_w${globalWeek}`,
          'deadlift',
          tmKeys.DEADLIFT,
          dlRampPct,
          4,
          4,
          'main',
          `Peso muerto ramping. ${(dlRampPct * 100).toFixed(0)}% TM.`
        ),
        flatNcSlot(
          `jaw_b${blockNum}_rear_delt_d1_w${globalWeek}`,
          'rear_delt_band',
          ACC.SEAL_ROW,
          3,
          15,
          'accessory',
          'Deltoides posterior con banda elastica. Obligatorio.'
        ),
      ],
    });

    // Day 2: Bench JAW + Squat JAW + DL from elevation + accessories
    const d2Accessories: readonly SlotDef[] =
      blockNum === 2
        ? [
            flatNcSlot(
              `jaw_b${blockNum}_seal_row_d2_w${globalWeek}`,
              'seal_row',
              ACC.SEAL_ROW,
              3,
              8,
              'accessory',
              'Seal row. Obligatorio por impacto coordinativo.'
            ),
          ]
        : [];

    days.push({
      name: `JAW Mod B${blockNum} Sem. ${globalWeek} — Dia 2`,
      slots: [
        tmNcSlot(
          `jaw_b${blockNum}_bench_d2_w${globalWeek}`,
          'bench',
          tmKeys.BENCH,
          benchEntry.pct,
          benchEntry.sets,
          benchEntry.reps,
          'main',
          `JAW Mod Bloque ${blockNum}, Semana ${globalWeek}. ${benchPctLabel} TM. ${REST_6MIN}`
        ),
        tmNcSlot(
          `jaw_b${blockNum}_squat_d2_w${globalWeek}`,
          'squat',
          tmKeys.SQUAT,
          sqEntry.pct,
          sqEntry.sets,
          sqEntry.reps,
          'main',
          `JAW Mod Bloque ${blockNum}, Semana ${globalWeek}. ${pctLabel} TM. ${REST_6MIN}`
        ),
        tmNcSlot(
          `jaw_b${blockNum}_dl_elev_d2_w${globalWeek}`,
          'deadlift_elevated',
          tmKeys.DEADLIFT,
          dlRampPct + 0.05,
          4,
          3,
          'main',
          `Peso muerto desde elevacion (rialzo). ${((dlRampPct + 0.05) * 100).toFixed(0)}% TM.`
        ),
        ...d2Accessories,
        flatNcSlot(
          `jaw_b${blockNum}_rear_delt_d2_w${globalWeek}`,
          'rear_delt_band',
          ACC.SEAL_ROW,
          3,
          15,
          'accessory',
          'Deltoides posterior con banda elastica.'
        ),
      ],
    });

    // Day 3: Bench JAW + Squat JAW + Curl + French press (superset) + Rear delt
    days.push({
      name: `JAW Mod B${blockNum} Sem. ${globalWeek} — Dia 3`,
      slots: [
        tmNcSlot(
          `jaw_b${blockNum}_bench_d3_w${globalWeek}`,
          'bench',
          tmKeys.BENCH,
          benchEntry.pct,
          benchEntry.sets,
          benchEntry.reps,
          'main',
          `JAW Mod Bloque ${blockNum}, Semana ${globalWeek}. ${benchPctLabel} TM. ${REST_6MIN}`
        ),
        tmNcSlot(
          `jaw_b${blockNum}_squat_d3_w${globalWeek}`,
          'squat',
          tmKeys.SQUAT,
          sqEntry.pct,
          sqEntry.sets,
          sqEntry.reps,
          'main',
          `JAW Mod Bloque ${blockNum}, Semana ${globalWeek}. ${pctLabel} TM. ${REST_6MIN}`
        ),
        flatNcSlot(
          `jaw_b${blockNum}_curl_d3_w${globalWeek}`,
          'curl_elastico',
          ACC.ONE_ARM_ROW,
          3,
          12,
          'accessory',
          'Curl con elastico. Superserie con press frances.'
        ),
        flatNcSlot(
          `jaw_b${blockNum}_french_d3_w${globalWeek}`,
          'french_press_band',
          ACC.INCLINE_DB,
          3,
          12,
          'accessory',
          'Press frances con elastico. Superserie con curl.'
        ),
        flatNcSlot(
          `jaw_b${blockNum}_rear_delt_d3_w${globalWeek}`,
          'rear_delt_band',
          ACC.SEAL_ROW,
          3,
          15,
          'accessory',
          'Deltoides posterior con banda elastica.'
        ),
      ],
    });

    // Day 4: Light/optional (varies by block)
    if (blockNum === 1) {
      days.push({
        name: `JAW Mod B1 Sem. ${globalWeek} — Dia 4 (Ligero)`,
        slots: [
          tmNcSlot(
            `jaw_b1_dl_light_d4_w${globalWeek}`,
            'deadlift',
            tmKeys.DEADLIFT,
            0.525,
            5,
            5,
            'main',
            'Peso muerto 50-55% TM. 5x5 series. Ligero.'
          ),
          flatNcSlot(
            `jaw_b1_incline_db_d4_w${globalWeek}`,
            'incline_db_press',
            ACC.INCLINE_DB,
            3,
            10,
            'accessory',
            'Press inclinado mancuernas 30 grados.'
          ),
          flatNcSlot(
            `jaw_b1_seal_row_d4_w${globalWeek}`,
            'seal_row',
            ACC.SEAL_ROW,
            3,
            8,
            'accessory',
            'Seal row. Obligatorio.'
          ),
          flatNcSlot(
            `jaw_b1_bulgarian_d4_w${globalWeek}`,
            'bulgarian_split_squat',
            ACC.SEAL_ROW,
            3,
            8,
            'accessory',
            'Zancada bulgara + sentadilla ligera.'
          ),
          flatNcSlot(
            `jaw_b1_rear_delt_d4_w${globalWeek}`,
            'rear_delt_band',
            ACC.SEAL_ROW,
            3,
            15,
            'accessory',
            'Deltoides posterior con banda elastica.'
          ),
        ],
      });
    } else if (blockNum === 2) {
      days.push({
        name: `JAW Mod B2 Sem. ${globalWeek} — Dia 4 (Ligero)`,
        slots: [
          tmNcSlot(
            `jaw_b2_dl_ramp_d4_w${globalWeek}`,
            'deadlift',
            tmKeys.DEADLIFT,
            0.6,
            4,
            4,
            'main',
            'Peso muerto ramping. 60% TM.'
          ),
          flatNcSlot(
            `jaw_b2_incline_db_d4_w${globalWeek}`,
            'incline_db_press',
            ACC.INCLINE_DB,
            3,
            10,
            'accessory',
            'Press inclinado mancuernas.'
          ),
          flatNcSlot(
            `jaw_b2_seal_row_d4_w${globalWeek}`,
            'seal_row',
            ACC.SEAL_ROW,
            3,
            8,
            'accessory',
            'Seal row. Obligatorio.'
          ),
          flatNcSlot(
            `jaw_b2_bulgarian_d4_w${globalWeek}`,
            'bulgarian_split_squat',
            ACC.SEAL_ROW,
            3,
            8,
            'accessory',
            'Zancada bulgara.'
          ),
          flatNcSlot(
            `jaw_b2_rear_delt_d4_w${globalWeek}`,
            'rear_delt_band',
            ACC.SEAL_ROW,
            3,
            15,
            'accessory',
            'Deltoides posterior con banda elastica.'
          ),
        ],
      });
    } else {
      // Block 3: Day 4 is light/optional, minimal
      days.push({
        name: `JAW Mod B3 Sem. ${globalWeek} — Dia 4 (Ligero)`,
        slots: [
          flatNcSlot(
            `jaw_b3_seal_row_d4_w${globalWeek}`,
            'seal_row',
            ACC.SEAL_ROW,
            3,
            8,
            'accessory',
            'Seal row. Obligatorio.'
          ),
          flatNcSlot(
            `jaw_b3_rear_delt_d4_w${globalWeek}`,
            'rear_delt_band',
            ACC.SEAL_ROW,
            3,
            15,
            'accessory',
            'Deltoides posterior con banda elastica.'
          ),
        ],
      });
    }
  }

  // Max-test week (week 6/12/18) — 4 days: 3 test days + 1 light day
  const testWeek = weekStart + 5;

  // Day 1: Squat max test
  days.push({
    name: `JAW Mod Bloque ${blockNum} — Test Maximo Sentadilla`,
    slots: [
      maxTestSlot(
        `jaw_b${blockNum}_squat_test`,
        'squat',
        tmKeys.SQUAT,
        'Sentadilla',
        blockNum,
        nextBlockLabels.squat,
        nextBlockTmKeys.squat
      ),
    ],
  });

  // Day 2: Bench max test
  days.push({
    name: `JAW Mod Bloque ${blockNum} — Test Maximo Press Banca`,
    slots: [
      maxTestSlot(
        `jaw_b${blockNum}_bench_test`,
        'bench',
        tmKeys.BENCH,
        'Press Banca',
        blockNum,
        nextBlockLabels.bench,
        nextBlockTmKeys.bench
      ),
    ],
  });

  // Day 3: Deadlift max test
  days.push({
    name: `JAW Mod Bloque ${blockNum} — Test Maximo Peso Muerto`,
    slots: [
      maxTestSlot(
        `jaw_b${blockNum}_deadlift_test`,
        'deadlift',
        tmKeys.DEADLIFT,
        'Peso Muerto',
        blockNum,
        nextBlockLabels.deadlift,
        nextBlockTmKeys.deadlift
      ),
    ],
  });

  // Day 4: Light recovery
  days.push({
    name: `JAW Mod Bloque ${blockNum} — Sem. ${testWeek} Recuperacion`,
    slots: [
      flatNcSlot(
        `jaw_b${blockNum}_seal_row_test_w`,
        'seal_row',
        ACC.SEAL_ROW,
        3,
        8,
        'accessory',
        'Recuperacion activa. Seal row ligero.'
      ),
      flatNcSlot(
        `jaw_b${blockNum}_rear_delt_test_w`,
        'rear_delt_band',
        ACC.SEAL_ROW,
        3,
        15,
        'accessory',
        'Deltoides posterior con banda. Ligero.'
      ),
    ],
  });

  return days;
}

/** Next-block TM propagation target (string key or undefined for last block). */
type NextBlockTmTarget = {
  readonly squat: string | undefined;
  readonly bench: string | undefined;
  readonly deadlift: string | undefined;
};

function buildFaseJAWMod(): ProgramDay[] {
  const b1NextTm: NextBlockTmTarget = {
    squat: JAW_TM.B2.SQUAT,
    bench: JAW_TM.B2.BENCH,
    deadlift: JAW_TM.B2.DEADLIFT,
  };
  const b2NextTm: NextBlockTmTarget = {
    squat: JAW_TM.B3.SQUAT,
    bench: JAW_TM.B3.BENCH,
    deadlift: JAW_TM.B3.DEADLIFT,
  };
  const b3NextTm: NextBlockTmTarget = {
    squat: undefined,
    bench: undefined,
    deadlift: undefined,
  };

  const blocks = [
    {
      schedule: JAW_MOD_B1_SCHEDULE,
      benchSchedule: JAW_MOD_B1_BENCH_SCHEDULE,
      tmKeys: JAW_TM.B1,
      blockNum: 1,
      weekStart: 1,
      nextBlockTmKeys: b1NextTm,
      nextBlockLabels: {
        squat: 'Sentadilla — TM Bloque 2',
        bench: 'Press Banca — TM Bloque 2',
        deadlift: 'Peso Muerto — TM Bloque 2',
      },
    },
    {
      schedule: JAW_MOD_B2_SCHEDULE,
      benchSchedule: JAW_MOD_B2_SCHEDULE,
      tmKeys: JAW_TM.B2,
      blockNum: 2,
      weekStart: 7,
      nextBlockTmKeys: b2NextTm,
      nextBlockLabels: {
        squat: 'Sentadilla — TM Bloque 3',
        bench: 'Press Banca — TM Bloque 3',
        deadlift: 'Peso Muerto — TM Bloque 3',
      },
    },
    {
      schedule: JAW_MOD_B3_SCHEDULE,
      benchSchedule: JAW_MOD_B3_SCHEDULE,
      tmKeys: JAW_TM.B3,
      blockNum: 3,
      weekStart: 13,
      nextBlockTmKeys: b3NextTm,
      nextBlockLabels: {
        squat: '',
        bench: '',
        deadlift: '',
      },
    },
  ] as const;

  const days: ProgramDay[] = [];
  for (const block of blocks) {
    days.push(
      ...buildBlock(
        block.schedule,
        block.benchSchedule,
        block.tmKeys,
        block.blockNum,
        block.weekStart,
        block.nextBlockTmKeys,
        block.nextBlockLabels
      )
    );
  }
  return days;
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORT — SALA 3 DEFINITION JSONB
// ═══════════════════════════════════════════════════════════════════════

export const SALA_3_DEFINITION_JSONB = {
  configTitle: 'La Sala del Tiempo 3 — JAW Mod',
  configDescription:
    'Fase Tre: Protocolo JAW Mod. 18 semanas divididas en 3 bloques de 6. ' +
    'Cargas -10% respecto al JAW original (B1: 60%, B2: 70%, B3: 80%). ' +
    'Bench con 8 reps en B1. Test de maximo al final de cada bloque ' +
    '(singles/doubles sin grinding). 4 dias/semana.\n\n' +
    'Cada bloque tiene su propio Training Max. Al generar el programa, ' +
    'pon tu TM actual (~90% 1RM) en el Bloque 1. Tras el test del Bloque 1, ' +
    'actualiza el TM del Bloque 2 con tu nuevo record (o deja que se propague ' +
    'automaticamente si registras el resultado en la app).',
  configEditTitle: 'Editar Training Max — JAW Mod',
  configEditDescription:
    'Actualiza los Training Max de cada bloque. Tras completar un test de maximo, ' +
    'el TM del bloque siguiente se actualiza automaticamente si registras el peso.',
  cycleLength: 72,
  totalWorkouts: 72,
  workoutsPerWeek: 4,
  exercises: {
    squat: {},
    bench: {},
    deadlift: {},
    deadlift_elevated: {},
    seal_row: {},
    incline_db_press: {},
    one_arm_row: {},
    rear_delt_band: {},
    curl_elastico: {},
    french_press_band: {},
    bulgarian_split_squat: {},
  },
  configFields: [
    // Group: JAW Bloque 1 — TM
    {
      key: 'squat_jaw_b1_tm',
      label: 'Sentadilla — TM Bloque 1',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'JAW Bloque 1 — TM',
      hint: 'Pon tu TM actual (~90% 1RM). Actualizaras los siguientes bloques tras cada test.',
      groupHint:
        'Sem. 1-5: entreno · Sem. 6: test de maximo (sentadilla, banca y peso muerto por separado). Tras el test, actualiza los TM del Bloque 2.',
    },
    {
      key: 'bench_jaw_b1_tm',
      label: 'Press Banca — TM Bloque 1',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'JAW Bloque 1 — TM',
      hint: 'Pon tu TM actual (~90% 1RM). Actualizaras los siguientes bloques tras cada test.',
    },
    {
      key: 'deadlift_jaw_b1_tm',
      label: 'Peso Muerto — TM Bloque 1',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'JAW Bloque 1 — TM',
      hint: 'Pon tu TM actual (~90% 1RM). Actualizaras los siguientes bloques tras cada test.',
    },
    // Group: JAW Bloque 2 — TM
    {
      key: 'squat_jaw_b2_tm',
      label: 'Sentadilla — TM Bloque 2',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'JAW Bloque 2 — TM',
      hint: 'Actualiza con tu nuevo record tras el test al final del Bloque 1.',
      groupHint:
        'Sem. 7-11: entreno · Sem. 12: test de maximo. Tras el test, actualiza los TM del Bloque 3.',
    },
    {
      key: 'bench_jaw_b2_tm',
      label: 'Press Banca — TM Bloque 2',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'JAW Bloque 2 — TM',
      hint: 'Actualiza con tu nuevo record tras el test al final del Bloque 1.',
    },
    {
      key: 'deadlift_jaw_b2_tm',
      label: 'Peso Muerto — TM Bloque 2',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'JAW Bloque 2 — TM',
      hint: 'Actualiza con tu nuevo record tras el test al final del Bloque 1.',
    },
    // Group: JAW Bloque 3 — TM
    {
      key: 'squat_jaw_b3_tm',
      label: 'Sentadilla — TM Bloque 3',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'JAW Bloque 3 — TM',
      hint: 'Actualiza con tu nuevo record tras el test al final del Bloque 2.',
      groupHint:
        'Sem. 13-17: entreno · Sem. 18: test final de la fase JAW. Ultimo bloque — no hay bloque siguiente.',
    },
    {
      key: 'bench_jaw_b3_tm',
      label: 'Press Banca — TM Bloque 3',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'JAW Bloque 3 — TM',
      hint: 'Actualiza con tu nuevo record tras el test al final del Bloque 2.',
    },
    {
      key: 'deadlift_jaw_b3_tm',
      label: 'Peso Muerto — TM Bloque 3',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'JAW Bloque 3 — TM',
      hint: 'Actualiza con tu nuevo record tras el test al final del Bloque 2.',
    },
    // Group: Accesorios
    {
      key: 'acc_incline_db_press',
      label: 'Press Inclinado Mancuernas',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Accesorios',
    },
    {
      key: 'acc_seal_row',
      label: 'Seal Row',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Accesorios',
    },
    {
      key: 'acc_one_arm_row',
      label: 'Remo Unilateral',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Accesorios',
    },
  ],
  weightIncrements: {},
  days: [...buildFaseJAWMod()],
};
