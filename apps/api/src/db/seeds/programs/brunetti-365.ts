// brunetti-365.ts — "365 Programmare l'Ipertrofia" by Amerigo Brunetti
// 212 workouts, 5 phases, ~45-50 weeks
//
// NOTE: This file exceeds the 600-line warning threshold. It is a pure data
// file encoding 212 unique workout days. Splitting into separate phase files
// would fragment the data without improving readability.

import type { SlotDef } from './shared';
import { NC } from './shared';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

// ── TM Key Constants ──
const TM = {
  SQUAT: 'squat_tm',
  BENCH: 'bench_tm',
  DEADLIFT: 'deadlift_tm',
} as const;

const JAW_TM = {
  B1: { SQUAT: 'squat_jaw_b1_tm', BENCH: 'bench_jaw_b1_tm', DEADLIFT: 'deadlift_jaw_b1_tm' },
  B2: { SQUAT: 'squat_jaw_b2_tm', BENCH: 'bench_jaw_b2_tm', DEADLIFT: 'deadlift_jaw_b2_tm' },
  B3: { SQUAT: 'squat_jaw_b3_tm', BENCH: 'bench_jaw_b3_tm', DEADLIFT: 'deadlift_jaw_b3_tm' },
} as const;

const FZ_KEYS = {
  SQUAT: 'fz_squat_start',
  BENCH: 'fz_bench_start',
  DEADLIFT: 'fz_deadlift_start',
} as const;

// ── Tempo Notes ──
const TEMPO_D5F2S5 = 'Tempo: 5s bajada, 2s pausa, 5s subida (d5f2s5).';
const REST_6MIN = 'Descanso: 6 min entre series de fundamentales.';

// ── JAW Schedule Constants ──
const JAW_B1_SCHEDULE = [
  { pct: 0.7, reps: 10, sets: 6 }, // Week 1
  { pct: 0.72, reps: 10, sets: 5 }, // Week 2
  { pct: 0.74, reps: 10, sets: 4 }, // Week 3
  { pct: 0.76, reps: 10, sets: 3 }, // Week 4
  { pct: 0.8, reps: 5, sets: 4 }, // Week 5 (deload)
] as const;

const JAW_B2_SCHEDULE = [
  { pct: 0.8, reps: 6, sets: 6 }, // Week 7
  { pct: 0.82, reps: 6, sets: 5 }, // Week 8
  { pct: 0.84, reps: 6, sets: 4 }, // Week 9
  { pct: 0.86, reps: 6, sets: 3 }, // Week 10
  { pct: 0.75, reps: 3, sets: 5 }, // Week 11 (deload)
] as const;

const JAW_B3_SCHEDULE = [
  { pct: 0.9, reps: 3, sets: 6 }, // Week 13
  { pct: 0.92, reps: 3, sets: 5 }, // Week 14
  { pct: 0.94, reps: 3, sets: 4 }, // Week 15
  { pct: 0.96, reps: 3, sets: 3 }, // Week 16
  { pct: 0.825, reps: 4, sets: 3 }, // Week 17 (deload)
] as const;

// ═══════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

type ProgramDay = { readonly name: string; readonly slots: readonly SlotDef[] };

/** Create a TM-based slot with no_change progression. */
function tmNcSlot(
  id: string,
  exerciseId: string,
  tmKey: string,
  pct: number,
  sets: number,
  reps: number,
  tier: string = 'main',
  notes?: string
): SlotDef {
  return {
    id,
    exerciseId,
    tier,
    role: tier === 'main' ? 'primary' : 'secondary',
    trainingMaxKey: tmKey,
    tmPercent: pct,
    stages: [{ sets, reps }],
    onSuccess: NC,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: tmKey,
    ...(notes !== undefined ? { notes } : {}),
  };
}

/** Create a flat (absolute weight) slot with no_change progression. */
function flatNcSlot(
  id: string,
  exerciseId: string,
  startWeightKey: string,
  sets: number,
  reps: number,
  tier: string = 'accessory',
  notes?: string
): SlotDef {
  return {
    id,
    exerciseId,
    tier,
    role: 'accessory',
    stages: [{ sets, reps }],
    onSuccess: NC,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey,
    ...(notes !== undefined ? { notes } : {}),
  };
}

/** Create a max-test slot with instructional notes. */
function maxTestSlot(
  id: string,
  exerciseId: string,
  startWeightKey: string,
  liftName: string,
  blockNum: number,
  nextBlockTmLabel: string,
  propagatesTo?: string
): SlotDef {
  return {
    id,
    exerciseId,
    tier: 'main',
    role: 'primary',
    stages: [{ sets: 1, reps: 1 }],
    onSuccess: NC,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey,
    isTestSlot: true,
    ...(propagatesTo !== undefined ? { propagatesTo } : {}),
    notes:
      `TEST DE 1RM — ${liftName.toUpperCase()}. ` +
      'Calienta progresivamente hasta tu maximo. ' +
      (blockNum < 3
        ? `Despues, ve a "Editar configuracion" y actualiza ` +
          `"${nextBlockTmLabel}" con tu nuevo maximo.`
        : 'Registra tu resultado. Este es tu maximo final del protocolo JAW.'),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE BUILDERS
// ═══════════════════════════════════════════════════════════════════════

// ── Fase Zero (Incipit) — Days 0-15, 16 days, 8 weeks x 2 sessions/week ──

function buildFaseZero(): ProgramDay[] {
  const days: ProgramDay[] = [];

  // Week-by-week squat volume: { sets, reps } — Brunetti notation: reps x sets
  const squatVolume: readonly { readonly sets: number; readonly reps: number }[] = [
    { sets: 6, reps: 5 }, // Week 1: 5x6s
    { sets: 6, reps: 5 }, // Week 2: 5x6s (+2.5kg manual)
    { sets: 5, reps: 4 }, // Week 3: 4x5s
    { sets: 5, reps: 4 }, // Week 4: 4x5s
    { sets: 3, reps: 5 }, // Week 5: 5x3s
    { sets: 5, reps: 4 }, // Week 6: 4x5s
    { sets: 3, reps: 5 }, // Week 7: repeat week 5
    { sets: 5, reps: 4 }, // Week 8: repeat week 6
  ];

  const benchVolume: readonly { readonly sets: number; readonly reps: number }[] = [
    { sets: 5, reps: 5 },
    { sets: 5, reps: 5 },
    { sets: 4, reps: 4 },
    { sets: 4, reps: 4 },
    { sets: 3, reps: 5 },
    { sets: 4, reps: 4 },
    { sets: 3, reps: 5 },
    { sets: 4, reps: 4 },
  ];

  const deadliftVolume: readonly { readonly sets: number; readonly reps: number }[] = [
    { sets: 5, reps: 5 },
    { sets: 5, reps: 5 },
    { sets: 4, reps: 4 },
    { sets: 4, reps: 4 },
    { sets: 3, reps: 5 },
    { sets: 4, reps: 4 },
    { sets: 3, reps: 5 },
    { sets: 4, reps: 4 },
  ];

  const fzSquatNotes =
    `${TEMPO_D5F2S5} Focus en sentir TODO el pie en contacto con el suelo. ` +
    'Peso libre (sin porcentajes). Elige un peso que permita mantener el tempo sin deteriorar la tecnica.';

  const fzBenchNotes =
    'Tecnica press banca: retraccion escapular, arco toracico, pies firmes. ' +
    'Peso libre. Focus en el patron de movimiento, no en la carga.';

  const fzDeadliftNotes =
    'Tecnica peso muerto: espalda neutra, activar dorsales antes de tirar. ' +
    'Descenso controlado. Peso libre. Focus en posicion inicial impecable.';

  const exitNotes =
    'Criterios de salida para avanzar a Fase T1: ' +
    '3 reps sentadilla al peso corporal con tempo controlado (5s bajada, 3s pausa, 5s subida), ' +
    '1 rep press banca al peso corporal con forma perfecta, ' +
    '10 reps peso muerto al peso corporal con descenso controlado. ' +
    'Mujeres: mismos criterios al 70% del peso corporal.';

  for (let week = 1; week <= 8; week++) {
    const sv = squatVolume[week - 1];
    const bv = benchVolume[week - 1];
    const dv = deadliftVolume[week - 1];
    const isLastWeek = week === 8;

    // Day 1: Squat focus
    days.push({
      name: `FZ Sem. ${week} — Dia 1 (Sentadilla)`,
      slots: [
        flatNcSlot(
          `fz_squat_w${week}`,
          'squat',
          FZ_KEYS.SQUAT,
          sv.sets,
          sv.reps,
          'main',
          fzSquatNotes
        ),
        flatNcSlot(
          `fz_gemelo_d1_w${week}`,
          'gemelo_pie',
          FZ_KEYS.SQUAT,
          3,
          10,
          'accessory',
          'Calentamiento: gemelos de pie, empujar con el avampiede, 5s subida.'
        ),
      ],
    });

    // Day 2: Bench + Deadlift focus
    days.push({
      name: `FZ Sem. ${week} — Dia 2 (Banca/Muerto)`,
      slots: [
        flatNcSlot(
          `fz_bench_w${week}`,
          'bench',
          FZ_KEYS.BENCH,
          bv.sets,
          bv.reps,
          'main',
          fzBenchNotes
        ),
        flatNcSlot(
          `fz_deadlift_w${week}`,
          'deadlift',
          FZ_KEYS.DEADLIFT,
          dv.sets,
          dv.reps,
          'main',
          isLastWeek ? `${fzDeadliftNotes} ${exitNotes}` : fzDeadliftNotes
        ),
        flatNcSlot(
          `fz_gemelo_d2_w${week}`,
          'gemelo_pie',
          FZ_KEYS.SQUAT,
          3,
          10,
          'accessory',
          'Calentamiento: gemelos de pie.'
        ),
      ],
    });
  }

  return days;
}

// ── Fase T1 (Perfezionamento Tecnico) — Days 16-39, 24 days, 6 weeks x 4 days/week ──

function buildFaseT1(): ProgramDay[] {
  const days: ProgramDay[] = [];

  // Week-by-week squat % for Day 1 (slow tempo work)
  const squatD1Pcts = [0.4, 0.45, 0.5, 0.4, 0.5, 0.55];
  const squatD1Volume: readonly { readonly sets: number; readonly reps: number }[] = [
    { sets: 10, reps: 4 }, // 4x10s -> Brunetti: 4 reps x 10 sets? No: 40-60% 4x10 series = 4 sets x 10 reps but using fundamental notation = 10 reps x 4 sets
    { sets: 10, reps: 4 },
    { sets: 10, reps: 4 },
    { sets: 10, reps: 4 },
    { sets: 10, reps: 4 },
    { sets: 8, reps: 3 }, // Week 6: intensity increase
  ];

  // Bench wave loading on Day 1: simplified representation
  // Week 1-3 (Blocco 1): 50% range, Week 4-6 (Blocco 2): 55% range
  const benchD1Pcts = [0.5, 0.5, 0.5, 0.55, 0.55, 0.55];

  // Deadlift Day 1 %
  const dlD1Pcts = [0.55, 0.55, 0.6, 0.6, 0.65, 0.65];
  const dlD1Volume: readonly { readonly sets: number; readonly reps: number }[] = [
    { sets: 5, reps: 5 },
    { sets: 5, reps: 5 },
    { sets: 4, reps: 6 },
    { sets: 4, reps: 6 },
    { sets: 6, reps: 4 },
    { sets: 6, reps: 4 },
  ];

  // Bench board/pin Day 2 %
  const benchD2Pcts = [0.7, 0.72, 0.75, 0.75, 0.78, 0.8];
  const benchD2Volume: readonly { readonly sets: number; readonly reps: number }[] = [
    { sets: 6, reps: 3 },
    { sets: 6, reps: 3 },
    { sets: 5, reps: 3 },
    { sets: 5, reps: 3 },
    { sets: 4, reps: 3 },
    { sets: 4, reps: 3 },
  ];

  // Deadlift from blocks Day 2
  const dlBlocksPcts = [0.55, 0.58, 0.6, 0.6, 0.63, 0.65];

  // Deadlift Day 3 main %
  const dlD3Pcts = [0.55, 0.58, 0.6, 0.6, 0.63, 0.65];
  const dlD3Volume: readonly { readonly sets: number; readonly reps: number }[] = [
    { sets: 4, reps: 4 },
    { sets: 4, reps: 4 },
    { sets: 3, reps: 3 },
    { sets: 3, reps: 3 },
    { sets: 4, reps: 3 },
    { sets: 4, reps: 3 },
  ];

  // Pin squat Day 3 %
  const pinSquatPcts = [0.4, 0.45, 0.5, 0.5, 0.55, 0.6];

  for (let week = 1; week <= 6; week++) {
    const w = week - 1;
    const blocco = week <= 3 ? 1 : 2;

    // Day 1: Squat focus (slow tempo) + Bench wave + Deadlift
    days.push({
      name: `T1 Sem. ${week} — Dia 1 (Sentadilla)`,
      slots: [
        tmNcSlot(
          `t1_squat_d1_w${week}`,
          'squat',
          TM.SQUAT,
          squatD1Pcts[w],
          squatD1Volume[w].sets,
          squatD1Volume[w].reps,
          'main',
          `${TEMPO_D5F2S5} Blocco ${blocco}. ${squatD1Pcts[w] * 100}% TM.`
        ),
        tmNcSlot(
          `t1_bench_d1_w${week}`,
          'bench',
          TM.BENCH,
          benchD1Pcts[w],
          6,
          8,
          'main',
          `Wave loading. ${benchD1Pcts[w] * 100}% TM. Blocco ${blocco}.`
        ),
        tmNcSlot(
          `t1_deadlift_d1_w${week}`,
          'deadlift',
          TM.DEADLIFT,
          dlD1Pcts[w],
          dlD1Volume[w].sets,
          dlD1Volume[w].reps,
          'main',
          `${dlD1Pcts[w] * 100}% TM. Descanso 1 min.`
        ),
      ],
    });

    // Day 2: Bench focus (board/pin) + Deadlift from blocks + One-arm row + Incline DB
    days.push({
      name: `T1 Sem. ${week} — Dia 2 (Banca)`,
      slots: [
        tmNcSlot(
          `t1_bench_board_w${week}`,
          week <= 3 ? 'bench_pin' : 'bench_board',
          TM.BENCH,
          benchD2Pcts[w],
          benchD2Volume[w].sets,
          benchD2Volume[w].reps,
          'main',
          week <= 3
            ? `Pin a 7 cm del pecho. ${benchD2Pcts[w] * 100}% TM. Blocco 1.`
            : `Tabla 2.5-5 cm. ${benchD2Pcts[w] * 100}% TM. Blocco 2.`
        ),
        flatNcSlot(
          `t1_incline_db_w${week}`,
          'incline_db_press',
          'acc_incline_db_press',
          3,
          10,
          'accessory',
          'Press inclinado mancuernas, agarre martillo (hammer grip). Descenso controlado.'
        ),
        flatNcSlot(
          `t1_one_arm_row_w${week}`,
          'one_arm_row',
          'acc_one_arm_row',
          3,
          8,
          'accessory',
          'Remo unilateral. Deadstop en cada repeticion (pausa en el suelo).'
        ),
        tmNcSlot(
          `t1_dl_blocks_d2_w${week}`,
          'deadlift_partial_blocks',
          TM.DEADLIFT,
          dlBlocksPcts[w],
          4,
          4,
          'main',
          `Peso muerto desde bloques. ${dlBlocksPcts[w] * 100}% TM.`
        ),
      ],
    });

    // Day 3: Deadlift focus + Bench variation + Pin squat
    days.push({
      name: `T1 Sem. ${week} — Dia 3 (Peso Muerto)`,
      slots: [
        tmNcSlot(
          `t1_deadlift_d3_w${week}`,
          'deadlift',
          TM.DEADLIFT,
          dlD3Pcts[w],
          dlD3Volume[w].sets,
          dlD3Volume[w].reps,
          'main',
          `Wave loading peso muerto. ${dlD3Pcts[w] * 100}% TM.`
        ),
        tmNcSlot(
          `t1_bench_d3_w${week}`,
          'bench',
          TM.BENCH,
          benchD1Pcts[w] - 0.05,
          3,
          10,
          'main',
          'Press mancuernas 60 grados. Trabajo tecnico.'
        ),
        tmNcSlot(
          `t1_pin_squat_w${week}`,
          'pin_squat',
          TM.SQUAT,
          pinSquatPcts[w],
          4,
          3,
          'main',
          `Sentadilla desde pines. Multi-altura. Zapatillas planas, sin cinturon. ${pinSquatPcts[w] * 100}% TM.`
        ),
      ],
    });

    // Day 4: Light/optional (Aperturas + Bench board light + Squat light)
    days.push({
      name: `T1 Sem. ${week} — Dia 4 (Ligero)`,
      slots: [
        flatNcSlot(
          `t1_apert_d4_w${week}`,
          'apert',
          'acc_incline_db_press',
          3,
          12,
          'accessory',
          'Aperturas mancuernas. ROM limitado, porcion central. Ligero.'
        ),
        tmNcSlot(
          `t1_bench_board_d4_w${week}`,
          'bench_board',
          TM.BENCH,
          0.5,
          3,
          8,
          'accessory',
          'Press banca con tabla. Ligero, trabajo tecnico.'
        ),
        tmNcSlot(
          `t1_squat_d4_w${week}`,
          'squat',
          TM.SQUAT,
          0.35,
          3,
          8,
          'accessory',
          'Sentadilla ligera. No extenuante. Trabajo tecnico.'
        ),
      ],
    });
  }

  return days;
}

// ── Fase PN (Potenziamento Neurale) — Days 40-91, 52 days, 13 weeks x 4 days/week ──

function buildFasePN(): ProgramDay[] {
  const days: ProgramDay[] = [];

  // ── Squat PN ramping scheme ──
  // Blocco 1 (weeks 1-5)
  const squatPnB1: readonly {
    readonly ramps: readonly {
      readonly pct: number;
      readonly sets: number;
      readonly reps: number;
    }[];
    readonly backoff?: { readonly pct: number; readonly sets: number; readonly reps: number };
  }[] = [
    // Week 1: 40% 5x2s, 45% 4x2s, 50% 3x2s, 55% 2x2, 60% 1, backoff 45% 5x3s
    {
      ramps: [
        { pct: 0.4, sets: 2, reps: 5 },
        { pct: 0.45, sets: 2, reps: 4 },
        { pct: 0.5, sets: 2, reps: 3 },
        { pct: 0.55, sets: 2, reps: 2 },
        { pct: 0.6, sets: 1, reps: 1 },
      ],
      backoff: { pct: 0.45, sets: 3, reps: 5 },
    },
    // Week 2: 42% 5x2s, 47% 4x2s, 52% 3x2s, 57% 2x2, 62% 1, backoff 45% 5x4s
    {
      ramps: [
        { pct: 0.42, sets: 2, reps: 5 },
        { pct: 0.47, sets: 2, reps: 4 },
        { pct: 0.52, sets: 2, reps: 3 },
        { pct: 0.57, sets: 2, reps: 2 },
        { pct: 0.62, sets: 1, reps: 1 },
      ],
      backoff: { pct: 0.45, sets: 4, reps: 5 },
    },
    // Week 3: 44% 5x2s, 49% 4x2s, 54% 3x2s, 59% 2x2, 64% 1, backoff 45% 5x5
    {
      ramps: [
        { pct: 0.44, sets: 2, reps: 5 },
        { pct: 0.49, sets: 2, reps: 4 },
        { pct: 0.54, sets: 2, reps: 3 },
        { pct: 0.59, sets: 2, reps: 2 },
        { pct: 0.64, sets: 1, reps: 1 },
      ],
      backoff: { pct: 0.45, sets: 5, reps: 5 },
    },
    // Week 4: 40% 4x2s, 47.5% 3x2s, 55% 2x4s (eccentric slow, concentric normal)
    {
      ramps: [
        { pct: 0.4, sets: 2, reps: 4 },
        { pct: 0.475, sets: 2, reps: 3 },
        { pct: 0.55, sets: 4, reps: 2 },
      ],
    },
    // Week 5 (Reggio): 51% 4x2s, 56% 3x2s, 61% 2x2, 66% 1, backoff 50% 5x3s
    {
      ramps: [
        { pct: 0.51, sets: 2, reps: 4 },
        { pct: 0.56, sets: 2, reps: 3 },
        { pct: 0.61, sets: 2, reps: 2 },
        { pct: 0.66, sets: 1, reps: 1 },
      ],
      backoff: { pct: 0.5, sets: 3, reps: 5 },
    },
  ];

  // Blocco 2 (weeks 6-10) — +2-4% progression from Blocco 1
  const squatPnB2: typeof squatPnB1 = [
    // Week 6
    {
      ramps: [
        { pct: 0.46, sets: 2, reps: 5 },
        { pct: 0.51, sets: 2, reps: 4 },
        { pct: 0.56, sets: 2, reps: 3 },
        { pct: 0.61, sets: 2, reps: 2 },
        { pct: 0.66, sets: 1, reps: 1 },
      ],
      backoff: { pct: 0.5, sets: 3, reps: 5 },
    },
    // Week 7
    {
      ramps: [
        { pct: 0.48, sets: 2, reps: 5 },
        { pct: 0.53, sets: 2, reps: 4 },
        { pct: 0.58, sets: 2, reps: 3 },
        { pct: 0.63, sets: 2, reps: 2 },
        { pct: 0.68, sets: 1, reps: 1 },
      ],
      backoff: { pct: 0.5, sets: 4, reps: 5 },
    },
    // Week 8
    {
      ramps: [
        { pct: 0.5, sets: 2, reps: 5 },
        { pct: 0.55, sets: 2, reps: 4 },
        { pct: 0.6, sets: 2, reps: 3 },
        { pct: 0.65, sets: 2, reps: 2 },
        { pct: 0.7, sets: 1, reps: 1 },
      ],
      backoff: { pct: 0.5, sets: 5, reps: 5 },
    },
    // Week 9 (eccentric focus)
    {
      ramps: [
        { pct: 0.46, sets: 2, reps: 4 },
        { pct: 0.535, sets: 2, reps: 3 },
        { pct: 0.61, sets: 4, reps: 2 },
      ],
    },
    // Week 10 (Reggio)
    {
      ramps: [
        { pct: 0.57, sets: 2, reps: 4 },
        { pct: 0.62, sets: 2, reps: 3 },
        { pct: 0.67, sets: 2, reps: 2 },
        { pct: 0.72, sets: 1, reps: 1 },
      ],
      backoff: { pct: 0.55, sets: 3, reps: 5 },
    },
  ];

  // Transition weeks (11-13)
  const squatPnTransition: typeof squatPnB1 = [
    // Week 11
    {
      ramps: [
        { pct: 0.52, sets: 2, reps: 5 },
        { pct: 0.57, sets: 2, reps: 4 },
        { pct: 0.62, sets: 2, reps: 3 },
        { pct: 0.67, sets: 2, reps: 2 },
        { pct: 0.72, sets: 1, reps: 1 },
      ],
      backoff: { pct: 0.55, sets: 3, reps: 5 },
    },
    // Week 12
    {
      ramps: [
        { pct: 0.54, sets: 2, reps: 5 },
        { pct: 0.59, sets: 2, reps: 4 },
        { pct: 0.64, sets: 2, reps: 3 },
        { pct: 0.69, sets: 2, reps: 2 },
        { pct: 0.74, sets: 1, reps: 1 },
      ],
      backoff: { pct: 0.55, sets: 4, reps: 5 },
    },
    // Week 13
    {
      ramps: [
        { pct: 0.56, sets: 2, reps: 5 },
        { pct: 0.61, sets: 2, reps: 4 },
        { pct: 0.66, sets: 2, reps: 3 },
        { pct: 0.71, sets: 2, reps: 2 },
        { pct: 0.76, sets: 1, reps: 1 },
      ],
      backoff: { pct: 0.55, sets: 5, reps: 5 },
    },
  ];

  const allSquatPn = [...squatPnB1, ...squatPnB2, ...squatPnTransition];

  // ── Bench PN scheme (pin/board wave loading) ──
  const benchPnPcts = [0.55, 0.57, 0.59, 0.6, 0.62, 0.64, 0.65, 0.67, 0.69, 0.7, 0.72, 0.74, 0.75];

  // ── Deadlift PN scheme ──
  const dlPnPcts = [0.55, 0.57, 0.59, 0.6, 0.62, 0.6, 0.62, 0.64, 0.65, 0.67, 0.65, 0.67, 0.7];
  const dlPnVolume: readonly { readonly sets: number; readonly reps: number }[] = [
    { sets: 4, reps: 4 },
    { sets: 4, reps: 4 },
    { sets: 3, reps: 3 },
    { sets: 3, reps: 4 },
    { sets: 3, reps: 4 },
    { sets: 4, reps: 4 },
    { sets: 4, reps: 4 },
    { sets: 3, reps: 3 },
    { sets: 3, reps: 4 },
    { sets: 3, reps: 4 },
    { sets: 4, reps: 4 },
    { sets: 3, reps: 3 },
    { sets: 3, reps: 4 },
  ];

  // Deadlift elevated (rialzo) Day 2 percentages
  const dlElevPcts = [0.6, 0.62, 0.64, 0.65, 0.67, 0.62, 0.64, 0.66, 0.67, 0.69, 0.66, 0.68, 0.7];

  // Pin squat Day 3 percentages
  const pinSquatPnPcts = [
    0.4, 0.42, 0.44, 0.45, 0.47, 0.44, 0.46, 0.48, 0.5, 0.52, 0.5, 0.52, 0.55,
  ];

  for (let week = 1; week <= 13; week++) {
    const w = week - 1;
    const squatWeek = allSquatPn[w];
    const blocco = week <= 5 ? 1 : week <= 10 ? 2 : 3;

    // Day 1: Squat main (ramping) + Bench wave + Deadlift
    const squatSlots: SlotDef[] = squatWeek.ramps.map((r, i) =>
      tmNcSlot(
        `pn_squat_w${week}_r${i + 1}`,
        'squat',
        TM.SQUAT,
        r.pct,
        r.sets,
        r.reps,
        'main',
        `${TEMPO_D5F2S5} Rampa ${i + 1}. ${(r.pct * 100).toFixed(1)}% TM. ${REST_6MIN}`
      )
    );
    if (squatWeek.backoff) {
      squatSlots.push(
        tmNcSlot(
          `pn_squat_w${week}_bo`,
          'squat',
          TM.SQUAT,
          squatWeek.backoff.pct,
          squatWeek.backoff.sets,
          squatWeek.backoff.reps,
          'main',
          `Backoff. ${TEMPO_D5F2S5} ${(squatWeek.backoff.pct * 100).toFixed(1)}% TM.`
        )
      );
    }

    days.push({
      name: `PN Sem. ${week} — Dia 1 (Sentadilla)`,
      slots: [
        ...squatSlots,
        tmNcSlot(
          `pn_bench_d1_w${week}`,
          'bench',
          TM.BENCH,
          benchPnPcts[w],
          6,
          3,
          'main',
          `Wave loading banca. ${(benchPnPcts[w] * 100).toFixed(0)}% TM. Blocco ${blocco}.`
        ),
        tmNcSlot(
          `pn_deadlift_d1_w${week}`,
          'deadlift',
          TM.DEADLIFT,
          dlPnPcts[w],
          dlPnVolume[w].sets,
          dlPnVolume[w].reps,
          'main',
          `${(dlPnPcts[w] * 100).toFixed(0)}% TM. Descanso 1 min.`
        ),
      ],
    });

    // Day 2: Bench board/pin + Deadlift from elevation + One-arm row
    days.push({
      name: `PN Sem. ${week} — Dia 2 (Banca)`,
      slots: [
        tmNcSlot(
          `pn_bench_board_w${week}`,
          week <= 5 ? 'bench_pin' : 'bench_board',
          TM.BENCH,
          benchPnPcts[w] + 0.1,
          4,
          3,
          'main',
          week <= 5
            ? `Pin a 7 cm del pecho (altura fija). ${((benchPnPcts[w] + 0.1) * 100).toFixed(0)}% TM.`
            : `Tabla 2.5-5 cm. ${((benchPnPcts[w] + 0.1) * 100).toFixed(0)}% TM.`
        ),
        tmNcSlot(
          `pn_dl_elev_d2_w${week}`,
          'deadlift_elevated',
          TM.DEADLIFT,
          dlElevPcts[w],
          4,
          3,
          'main',
          `Peso muerto desde elevacion (rialzo 5 cm). ${(dlElevPcts[w] * 100).toFixed(0)}% TM.`
        ),
        flatNcSlot(
          `pn_one_arm_row_w${week}`,
          'one_arm_row',
          'acc_one_arm_row',
          3,
          8,
          'accessory',
          'Remo unilateral. Deadstop en cada rep.'
        ),
        flatNcSlot(
          `pn_incline_db_w${week}`,
          'incline_db_press',
          'acc_incline_db_press',
          3,
          10,
          'accessory',
          'Press inclinado mancuernas. Agarre martillo.'
        ),
      ],
    });

    // Day 3: Deadlift main + Bench variation + Pin squat
    days.push({
      name: `PN Sem. ${week} — Dia 3 (Peso Muerto)`,
      slots: [
        tmNcSlot(
          `pn_deadlift_d3_w${week}`,
          'deadlift',
          TM.DEADLIFT,
          dlPnPcts[w] + 0.05,
          dlPnVolume[w].sets,
          dlPnVolume[w].reps,
          'main',
          `Wave loading peso muerto. ${((dlPnPcts[w] + 0.05) * 100).toFixed(0)}% TM.`
        ),
        tmNcSlot(
          `pn_bench_d3_w${week}`,
          'bench',
          TM.BENCH,
          benchPnPcts[w] - 0.05,
          3,
          10,
          'main',
          'Press mancuernas 60 grados. Trabajo tecnico.'
        ),
        tmNcSlot(
          `pn_pin_squat_w${week}`,
          'pin_squat',
          TM.SQUAT,
          pinSquatPnPcts[w],
          4,
          3,
          'main',
          `Sentadilla desde pines. Multi-altura. ${(pinSquatPnPcts[w] * 100).toFixed(0)}% TM.`
        ),
      ],
    });

    // Day 4: Light/optional
    days.push({
      name: `PN Sem. ${week} — Dia 4 (Ligero)`,
      slots: [
        flatNcSlot(
          `pn_apert_d4_w${week}`,
          'apert',
          'acc_incline_db_press',
          3,
          12,
          'accessory',
          'Aperturas mancuernas. ROM limitado. Ligero.'
        ),
        tmNcSlot(
          `pn_bench_board_d4_w${week}`,
          'bench_board',
          TM.BENCH,
          0.5,
          3,
          8,
          'accessory',
          'Press banca con tabla. Ligero, tecnico.'
        ),
        tmNcSlot(
          `pn_squat_d4_w${week}`,
          'squat',
          TM.SQUAT,
          0.35,
          3,
          8,
          'accessory',
          'Sentadilla ligera. Tecnico.'
        ),
      ],
    });
  }

  return days;
}

// ── Fase JAW (Protocollo JAW) — Days 92-163, 72 days, 18 weeks x 4 days/week ──

function buildFaseJAW(): ProgramDay[] {
  const days: ProgramDay[] = [];

  const blocks = [
    { schedule: JAW_B1_SCHEDULE, tmKeys: JAW_TM.B1, blockNum: 1, weekStart: 1 },
    { schedule: JAW_B2_SCHEDULE, tmKeys: JAW_TM.B2, blockNum: 2, weekStart: 7 },
    { schedule: JAW_B3_SCHEDULE, tmKeys: JAW_TM.B3, blockNum: 3, weekStart: 13 },
  ] as const;

  const nextBlockLabels = {
    squat: ['Sentadilla — TM Bloque 2', 'Sentadilla — TM Bloque 3', ''],
    bench: ['Press Banca — TM Bloque 2', 'Press Banca — TM Bloque 3', ''],
    deadlift: ['Peso Muerto — TM Bloque 2', 'Peso Muerto — TM Bloque 3', ''],
  } as const;

  // Config keys to propagate test weight into (B1→B2, B2→B3, B3→none)
  const nextBlockTmKeys = {
    squat: [JAW_TM.B2.SQUAT, JAW_TM.B3.SQUAT, undefined],
    bench: [JAW_TM.B2.BENCH, JAW_TM.B3.BENCH, undefined],
    deadlift: [JAW_TM.B2.DEADLIFT, JAW_TM.B3.DEADLIFT, undefined],
  } as const;

  for (const block of blocks) {
    const { schedule, tmKeys, blockNum, weekStart } = block;

    // 5 training weeks
    for (let localWeek = 0; localWeek < 5; localWeek++) {
      const globalWeek = weekStart + localWeek;
      const { pct, reps, sets } = schedule[localWeek];
      const pctLabel = `${(pct * 100).toFixed(1)}%`;

      // Deadlift ramping % for Day 1/2 (separate from JAW main)
      const dlRampPct = blockNum === 1 ? 0.55 : blockNum === 2 ? 0.6 : 0.65;

      // Day 1: Squat JAW + Bench JAW + Deadlift ramping + Rear delt
      days.push({
        name: `JAW B${blockNum} Sem. ${globalWeek} — Dia 1`,
        slots: [
          tmNcSlot(
            `jaw_b${blockNum}_squat_d1_w${globalWeek}`,
            'squat',
            tmKeys.SQUAT,
            pct,
            sets,
            reps,
            'main',
            `JAW Bloque ${blockNum}, Semana ${globalWeek}. ${pctLabel} TM. ${REST_6MIN}`
          ),
          tmNcSlot(
            `jaw_b${blockNum}_bench_d1_w${globalWeek}`,
            'bench',
            tmKeys.BENCH,
            pct,
            sets,
            reps,
            'main',
            `JAW Bloque ${blockNum}, Semana ${globalWeek}. ${pctLabel} TM. ${REST_6MIN}`
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
            'acc_seal_row',
            3,
            15,
            'accessory',
            'Deltoides posterior con banda elastica. Obligatorio.'
          ),
        ],
      });

      // Day 2: Bench JAW + Squat JAW + DL from elevation + accessories
      const d2Accessories: SlotDef[] =
        blockNum === 2
          ? [
              flatNcSlot(
                `jaw_b${blockNum}_seal_row_d2_w${globalWeek}`,
                'seal_row',
                'acc_seal_row',
                3,
                8,
                'accessory',
                'Seal row. Obligatorio por impacto coordinativo.'
              ),
            ]
          : [];

      days.push({
        name: `JAW B${blockNum} Sem. ${globalWeek} — Dia 2`,
        slots: [
          tmNcSlot(
            `jaw_b${blockNum}_bench_d2_w${globalWeek}`,
            'bench',
            tmKeys.BENCH,
            pct,
            sets,
            reps,
            'main',
            `JAW Bloque ${blockNum}, Semana ${globalWeek}. ${pctLabel} TM. ${REST_6MIN}`
          ),
          tmNcSlot(
            `jaw_b${blockNum}_squat_d2_w${globalWeek}`,
            'squat',
            tmKeys.SQUAT,
            pct,
            sets,
            reps,
            'main',
            `JAW Bloque ${blockNum}, Semana ${globalWeek}. ${pctLabel} TM. ${REST_6MIN}`
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
            'acc_seal_row',
            3,
            15,
            'accessory',
            'Deltoides posterior con banda elastica.'
          ),
        ],
      });

      // Day 3: Bench JAW + Squat JAW + Curl + French press (superset) + Rear delt
      days.push({
        name: `JAW B${blockNum} Sem. ${globalWeek} — Dia 3`,
        slots: [
          tmNcSlot(
            `jaw_b${blockNum}_bench_d3_w${globalWeek}`,
            'bench',
            tmKeys.BENCH,
            pct,
            sets,
            reps,
            'main',
            `JAW Bloque ${blockNum}, Semana ${globalWeek}. ${pctLabel} TM. ${REST_6MIN}`
          ),
          tmNcSlot(
            `jaw_b${blockNum}_squat_d3_w${globalWeek}`,
            'squat',
            tmKeys.SQUAT,
            pct,
            sets,
            reps,
            'main',
            `JAW Bloque ${blockNum}, Semana ${globalWeek}. ${pctLabel} TM. ${REST_6MIN}`
          ),
          flatNcSlot(
            `jaw_b${blockNum}_curl_d3_w${globalWeek}`,
            'curl_elastico',
            'acc_one_arm_row',
            3,
            12,
            'accessory',
            'Curl con elastico. Superserie con press frances.'
          ),
          flatNcSlot(
            `jaw_b${blockNum}_french_d3_w${globalWeek}`,
            'french_press_band',
            'acc_incline_db_press',
            3,
            12,
            'accessory',
            'Press frances con elastico. Superserie con curl.'
          ),
          flatNcSlot(
            `jaw_b${blockNum}_rear_delt_d3_w${globalWeek}`,
            'rear_delt_band',
            'acc_seal_row',
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
          name: `JAW B1 Sem. ${globalWeek} — Dia 4 (Ligero)`,
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
              'acc_incline_db_press',
              3,
              10,
              'accessory',
              'Press inclinado mancuernas 30 grados.'
            ),
            flatNcSlot(
              `jaw_b1_seal_row_d4_w${globalWeek}`,
              'seal_row',
              'acc_seal_row',
              3,
              8,
              'accessory',
              'Seal row. Obligatorio.'
            ),
            flatNcSlot(
              `jaw_b1_bulgarian_d4_w${globalWeek}`,
              'bulgarian_split_squat',
              FZ_KEYS.SQUAT,
              3,
              8,
              'accessory',
              'Zancada bulgara + sentadilla ligera.'
            ),
            flatNcSlot(
              `jaw_b1_rear_delt_d4_w${globalWeek}`,
              'rear_delt_band',
              'acc_seal_row',
              3,
              15,
              'accessory',
              'Deltoides posterior con banda elastica.'
            ),
          ],
        });
      } else if (blockNum === 2) {
        days.push({
          name: `JAW B2 Sem. ${globalWeek} — Dia 4 (Ligero)`,
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
              'acc_incline_db_press',
              3,
              10,
              'accessory',
              'Press inclinado mancuernas.'
            ),
            flatNcSlot(
              `jaw_b2_seal_row_d4_w${globalWeek}`,
              'seal_row',
              'acc_seal_row',
              3,
              8,
              'accessory',
              'Seal row. Obligatorio.'
            ),
            flatNcSlot(
              `jaw_b2_bulgarian_d4_w${globalWeek}`,
              'bulgarian_split_squat',
              FZ_KEYS.SQUAT,
              3,
              8,
              'accessory',
              'Zancada bulgara.'
            ),
            flatNcSlot(
              `jaw_b2_rear_delt_d4_w${globalWeek}`,
              'rear_delt_band',
              'acc_seal_row',
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
          name: `JAW B3 Sem. ${globalWeek} — Dia 4 (Ligero)`,
          slots: [
            flatNcSlot(
              `jaw_b3_seal_row_d4_w${globalWeek}`,
              'seal_row',
              'acc_seal_row',
              3,
              8,
              'accessory',
              'Seal row. Obligatorio.'
            ),
            flatNcSlot(
              `jaw_b3_rear_delt_d4_w${globalWeek}`,
              'rear_delt_band',
              'acc_seal_row',
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
      name: `JAW Bloque ${blockNum} — Test Maximo Sentadilla`,
      slots: [
        maxTestSlot(
          `jaw_b${blockNum}_squat_test`,
          'squat',
          tmKeys.SQUAT,
          'Sentadilla',
          blockNum,
          nextBlockLabels.squat[blockNum - 1],
          nextBlockTmKeys.squat[blockNum - 1]
        ),
      ],
    });

    // Day 2: Bench max test
    days.push({
      name: `JAW Bloque ${blockNum} — Test Maximo Press Banca`,
      slots: [
        maxTestSlot(
          `jaw_b${blockNum}_bench_test`,
          'bench',
          tmKeys.BENCH,
          'Press Banca',
          blockNum,
          nextBlockLabels.bench[blockNum - 1],
          nextBlockTmKeys.bench[blockNum - 1]
        ),
      ],
    });

    // Day 3: Deadlift max test
    days.push({
      name: `JAW Bloque ${blockNum} — Test Maximo Peso Muerto`,
      slots: [
        maxTestSlot(
          `jaw_b${blockNum}_deadlift_test`,
          'deadlift',
          tmKeys.DEADLIFT,
          'Peso Muerto',
          blockNum,
          nextBlockLabels.deadlift[blockNum - 1],
          nextBlockTmKeys.deadlift[blockNum - 1]
        ),
      ],
    });

    // Day 4: Light recovery
    days.push({
      name: `JAW Bloque ${blockNum} — Sem. ${testWeek} Recuperacion`,
      slots: [
        flatNcSlot(
          `jaw_b${blockNum}_seal_row_test_w`,
          'seal_row',
          'acc_seal_row',
          3,
          8,
          'accessory',
          'Recuperacion activa. Seal row ligero.'
        ),
        flatNcSlot(
          `jaw_b${blockNum}_rear_delt_test_w`,
          'rear_delt_band',
          'acc_seal_row',
          3,
          15,
          'accessory',
          'Deltoides posterior con banda. Ligero.'
        ),
      ],
    });
  }

  return days;
}

// ── Fase IS (Ipertrofia Specifica) — Days 164-211, 48 days, 12 weeks x 4 days/week ──

function buildFaseIS(): ProgramDay[] {
  const days: ProgramDay[] = [];

  // IS bench scheme percentages (Sottofase 1 and 2)
  const benchIsD1Pcts = [
    0.825, 0.825, 0.825, 0.825, 0.825, 0.825, 0.85, 0.85, 0.85, 0.85, 0.85, 0.85,
  ];
  const benchIsD2Pcts = [0.775, 0.775, 0.775, 0.775, 0.775, 0.775, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8];

  // Squat IS scheme percentages
  const squatIsD1Pcts = [0.725, 0.725, 0.75, 0.75, 0.75, 0.775, 0.775, 0.775, 0.8, 0.8, 0.8, 0.825];

  // Deadlift IS scheme percentages
  const dlIsD3Pcts = [0.65, 0.65, 0.675, 0.675, 0.675, 0.7, 0.7, 0.7, 0.725, 0.725, 0.725, 0.75];

  // B.C. isolation rep scheme differs by sottofase
  const bcSets = (week: number): number => (week <= 6 ? 3 : 4);
  const bcReps = (week: number): number => (week <= 6 ? 8 : 15);
  const bcNotes = (week: number): string =>
    week <= 6
      ? 'B.C. Sottofase 1: adaptacion. Reps 6-12. Descanso 1:30-2 min. No forzar estres metabolico.'
      : 'B.C. Sottofase 2: maximo estres metabolico localizado. Reps 12-30. Descanso 1-1:30 min.';

  for (let week = 1; week <= 12; week++) {
    const w = week - 1;
    const sottofase = week <= 6 ? 1 : 2;
    const sfLabel = `S${sottofase}`;

    // Day 1: Squat main + Bench + Pecs/Tris B.C. + Deadlift variant + Rear delt
    days.push({
      name: `IS ${sfLabel} Sem. ${week} — Dia 1 (Sentadilla)`,
      slots: [
        tmNcSlot(
          `is_squat_d1_w${week}`,
          'squat',
          TM.SQUAT,
          squatIsD1Pcts[w],
          4,
          4,
          'main',
          `Sentadilla IS. ${(squatIsD1Pcts[w] * 100).toFixed(1)}% TM. Wave loading.`
        ),
        tmNcSlot(
          `is_bench_d1_w${week}`,
          'bench',
          TM.BENCH,
          benchIsD1Pcts[w],
          3,
          7,
          'main',
          `Press banca IS. ${(benchIsD1Pcts[w] * 100).toFixed(1)}% TM.`
        ),
        flatNcSlot(
          `is_pecs_bc_d1_w${week}`,
          'incline_db_press',
          'acc_incline_db_press',
          bcSets(week),
          bcReps(week),
          'accessory',
          `${bcNotes(week)} Pectorales/triceps.`
        ),
        tmNcSlot(
          `is_dl_variant_d1_w${week}`,
          'deadlift_elevated',
          TM.DEADLIFT,
          dlIsD3Pcts[w] - 0.05,
          3,
          4,
          'main',
          'Peso muerto variante desde elevacion. Volumen bajo.'
        ),
        flatNcSlot(
          `is_rear_delt_d1_w${week}`,
          'rear_delt_band',
          'acc_seal_row',
          3,
          15,
          'accessory',
          'Deltoides posterior con banda. Obligatorio.'
        ),
      ],
    });

    // Day 2: Bench main + Dorsal B.C. + Legs B.C. + DL from elevation + Rear delt
    days.push({
      name: `IS ${sfLabel} Sem. ${week} — Dia 2 (Banca)`,
      slots: [
        tmNcSlot(
          `is_bench_d2_w${week}`,
          'bench',
          TM.BENCH,
          benchIsD2Pcts[w],
          3,
          6,
          'main',
          `Press banca IS. ${(benchIsD2Pcts[w] * 100).toFixed(1)}% TM.`
        ),
        flatNcSlot(
          `is_seal_row_d2_w${week}`,
          'seal_row',
          'acc_seal_row',
          bcSets(week),
          bcReps(week),
          'accessory',
          `${bcNotes(week)} Dorsales B.C. Seal row obligatorio.`
        ),
        flatNcSlot(
          `is_one_arm_row_d2_w${week}`,
          'one_arm_row',
          'acc_one_arm_row',
          bcSets(week),
          bcReps(week),
          'accessory',
          `${bcNotes(week)} Dorsales B.C.`
        ),
        flatNcSlot(
          `is_leg_press_d2_w${week}`,
          'prensa',
          FZ_KEYS.SQUAT,
          bcSets(week),
          bcReps(week),
          'accessory',
          `${bcNotes(week)} Piernas B.C.`
        ),
        flatNcSlot(
          `is_leg_ext_d2_w${week}`,
          'ext_quad',
          FZ_KEYS.SQUAT,
          bcSets(week),
          bcReps(week),
          'accessory',
          `${bcNotes(week)} Piernas B.C.`
        ),
        flatNcSlot(
          `is_leg_curl_d2_w${week}`,
          'curl_fem',
          FZ_KEYS.SQUAT,
          bcSets(week),
          bcReps(week),
          'accessory',
          `${bcNotes(week)} Piernas B.C.`
        ),
        tmNcSlot(
          `is_dl_elev_d2_w${week}`,
          'deadlift_elevated',
          TM.DEADLIFT,
          dlIsD3Pcts[w],
          3,
          3,
          'main',
          'Peso muerto desde elevacion. RPE @8.'
        ),
        flatNcSlot(
          `is_rear_delt_d2_w${week}`,
          'rear_delt_band',
          'acc_seal_row',
          3,
          15,
          'accessory',
          'Deltoides posterior con banda.'
        ),
      ],
    });

    // Day 3: Deadlift main + Bench pin/board + Delts B.C. + Squat ramping + Rear delt
    days.push({
      name: `IS ${sfLabel} Sem. ${week} — Dia 3 (Peso Muerto)`,
      slots: [
        tmNcSlot(
          `is_deadlift_d3_w${week}`,
          'deadlift',
          TM.DEADLIFT,
          dlIsD3Pcts[w],
          4,
          4,
          'main',
          `Peso muerto IS principal. ${(dlIsD3Pcts[w] * 100).toFixed(1)}% TM. Wave loading.`
        ),
        tmNcSlot(
          `is_bench_pin_d3_w${week}`,
          'bench_pin',
          TM.BENCH,
          sottofase === 1 ? 0.75 : 0.7,
          3,
          3,
          'main',
          sottofase === 1
            ? 'Press banca con pin. RPE @8.'
            : 'Press banca con pin. RPE @7 (efecto buco coordinativo).'
        ),
        flatNcSlot(
          `is_lat_raise_d3_w${week}`,
          'lateral_raise_seated',
          'acc_incline_db_press',
          bcSets(week),
          bcReps(week),
          'accessory',
          `${bcNotes(week)} Deltoides B.C.`
        ),
        tmNcSlot(
          `is_squat_ramp_d3_w${week}`,
          'squat',
          TM.SQUAT,
          squatIsD1Pcts[w] - 0.05,
          3,
          3,
          'main',
          'Sentadilla ramping. Trabajo tecnico.'
        ),
        flatNcSlot(
          `is_rear_delt_d3_w${week}`,
          'rear_delt_band',
          'acc_seal_row',
          3,
          15,
          'accessory',
          'Deltoides posterior con banda.'
        ),
      ],
    });

    // Day 4: Bulgarian/Front squat + Incline DB + Seal row + Biceps/Tris B.C. + Rear delt
    days.push({
      name: `IS ${sfLabel} Sem. ${week} — Dia 4 (Accesorios)`,
      slots: [
        flatNcSlot(
          `is_bulgarian_d4_w${week}`,
          week % 2 === 1 ? 'bulgarian_split_squat' : 'front_squat',
          FZ_KEYS.SQUAT,
          3,
          8,
          'accessory',
          week % 2 === 1
            ? 'Zancada bulgara. Control y estabilidad.'
            : 'Sentadilla frontal. Trabajo de movilidad.'
        ),
        flatNcSlot(
          `is_incline_db_d4_w${week}`,
          'incline_db_press',
          'acc_incline_db_press',
          3,
          10,
          'accessory',
          'Press inclinado mancuernas / press militar. RPE @7.'
        ),
        flatNcSlot(
          `is_seal_row_d4_w${week}`,
          'seal_row',
          'acc_seal_row',
          3,
          8,
          'accessory',
          'Seal row. Obligatorio 2x/semana.'
        ),
        flatNcSlot(
          `is_curl_bc_d4_w${week}`,
          'curl_elastico',
          'acc_one_arm_row',
          bcSets(week),
          bcReps(week),
          'accessory',
          `${bcNotes(week)} Biceps B.C.`
        ),
        flatNcSlot(
          `is_french_bc_d4_w${week}`,
          'french_press_band',
          'acc_incline_db_press',
          bcSets(week),
          bcReps(week),
          'accessory',
          `${bcNotes(week)} Triceps B.C.`
        ),
        flatNcSlot(
          `is_rear_delt_d4_w${week}`,
          'rear_delt_band',
          'acc_seal_row',
          3,
          15,
          'accessory',
          'Deltoides posterior con banda.'
        ),
      ],
    });
  }

  return days;
}

// ═══════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════

export const BRUNETTI365_DEFINITION_JSONB = {
  configTitle: "365 Programmare l'Ipertrofia",
  configDescription:
    'Programa anual de hipertrofia de Amerigo Brunetti. 5 fases secuenciales: ' +
    'Fase Zero (tecnica), T1 (perfeccionamiento), PN (potenciacion neural), ' +
    'JAW (volumen intenso), IS (hipertrofia especifica). ' +
    'Para la fase JAW necesitaras actualizar tu Training Max despues de cada ' +
    'test de maximo (cada 6 semanas, 3 bloques).',
  configEditTitle: 'Editar Pesos y Training Max',
  configEditDescription:
    'Actualiza tus Training Max o pesos iniciales. ' +
    'Durante la fase JAW, actualiza los TM del bloque correspondiente ' +
    'despues de cada test de maximo.',
  cycleLength: 212,
  totalWorkouts: 212,
  workoutsPerWeek: 4,
  exercises: {
    squat: {},
    bench: {},
    deadlift: {},
    incline_db_press: {},
    front_squat: {},
    bulgarian_split_squat: {},
    deadlift_partial_blocks: {},
    apert: {},
    triceps_pushdown: {},
    ext_quad: {},
    curl_fem: {},
    leg_press_gem: {},
    gemelo_pie: {},
    rear_delt_band: {},
    leg_curl_prone: {},
    curl_bar: {},
    prensa: {},
    bench_board: {},
    bench_pin: {},
    one_arm_row: {},
    deadlift_elevated: {},
    seal_row: {},
    leg_press_unilateral: {},
    curl_elastico: {},
    french_press_band: {},
    lateral_raise_seated: {},
    pin_squat: {},
  },
  configFields: [
    // Group: Training Max
    {
      key: 'squat_tm',
      label: 'Sentadilla (Training Max)',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'Training Max',
      hint: '~90% de tu 1RM con buena tecnica. Se usa en las fases T1 y PN.',
    },
    {
      key: 'bench_tm',
      label: 'Press Banca (Training Max)',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'Training Max',
      hint: '~90% de tu 1RM con buena tecnica. Se usa en las fases T1 y PN.',
    },
    {
      key: 'deadlift_tm',
      label: 'Peso Muerto (Training Max)',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'Training Max',
      hint: '~90% de tu 1RM con buena tecnica. Se usa en las fases T1 y PN.',
    },
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
    // Group: Pesos Iniciales — Fase Zero
    {
      key: 'fz_squat_start',
      label: 'Sentadilla (peso Fase Zero)',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Pesos Iniciales — Fase Zero',
    },
    {
      key: 'fz_bench_start',
      label: 'Press Banca (peso Fase Zero)',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Pesos Iniciales — Fase Zero',
    },
    {
      key: 'fz_deadlift_start',
      label: 'Peso Muerto (peso Fase Zero)',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Pesos Iniciales — Fase Zero',
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
  days: [
    ...buildFaseZero(), // days 0-15   (16 days)
    ...buildFaseT1(), // days 16-39  (24 days)
    ...buildFasePN(), // days 40-91  (52 days)
    ...buildFaseJAW(), // days 92-163 (72 days)
    ...buildFaseIS(), // days 164-211 (48 days)
  ],
};

// ═══════════════════════════════════════════════════════════════════════
// EXPERIENCED VARIANT (skips Fase Zero — 196 workouts)
// ═══════════════════════════════════════════════════════════════════════

const SHARED_CONFIG_FIELDS = BRUNETTI365_DEFINITION_JSONB.configFields.filter(
  (f) => f.group !== 'Pesos Iniciales — Fase Zero'
);

export const BRUNETTI365_EXP_DEFINITION_JSONB = {
  configTitle: 'La Sala del Tiempo',
  configDescription:
    'Inspirado en la metodologia de Amerigo Brunetti. 196 sesiones de hipertrofia ' +
    'estructurada en 4 fases: T1 (perfeccionamiento), PN (potenciacion neural), ' +
    'JAW (volumen intenso) e IS (hipertrofia especifica). ' +
    'Para guerreros que ya dominan los tres levantamientos fundamentales.\n\n' +
    'Training Max: es el peso que puedes levantar con buena tecnica (~90% de tu 1RM). ' +
    'Se usa durante las fases T1 y PN. ' +
    'La fase JAW se divide en 3 bloques de 6 semanas. Al final de cada bloque haras ' +
    'un test de maximo — usa ese resultado para actualizar el TM del bloque siguiente. ' +
    'Al generar el programa, puedes poner el mismo TM en todos los bloques y actualizarlo ' +
    'mas adelante desde "Editar configuracion".',
  configEditTitle: BRUNETTI365_DEFINITION_JSONB.configEditTitle,
  configEditDescription:
    'Actualiza tus Training Max. Durante la fase JAW, actualiza los TM del bloque ' +
    'correspondiente despues de cada test de maximo. Si acabas de terminar el Bloque 1, ' +
    'actualiza el TM del Bloque 2 con tu nuevo record.',
  cycleLength: 196,
  totalWorkouts: 196,
  workoutsPerWeek: 4,
  exercises: BRUNETTI365_DEFINITION_JSONB.exercises,
  configFields: SHARED_CONFIG_FIELDS,
  weightIncrements: {},
  days: [
    ...buildFaseT1(), // days 0-23   (24 days)
    ...buildFasePN(), // days 24-75  (52 days)
    ...buildFaseJAW(), // days 76-147 (72 days)
    ...buildFaseIS(), // days 148-195 (48 days)
  ],
};
