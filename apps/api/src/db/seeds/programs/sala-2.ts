// sala-2.ts — "La Sala del Tiempo 2" (Fase Due: Potenziamento Neurale)
// 52 workouts, 13 weeks x 4 days/week
//
// Standalone PN phase extracted from brunetti-365.ts.
// Neural potentiation: transferring technique to heavier loads (60-95% TM).

import type { ProgramDay, SlotDef } from './shared';
import { BRUNETTI_TM, tmNcSlot, flatNcSlot } from './shared';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

const TM = BRUNETTI_TM;

const TEMPO_D5F2S5 = 'Tempo: 5s bajada, 2s pausa, 5s subida (d5f2s5).';
const REST_6MIN = 'Descanso: 6 min entre series de fundamentales.';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

interface RampEntry {
  readonly pct: number;
  readonly sets: number;
  readonly reps: number;
}

interface SquatPnWeek {
  readonly ramps: readonly RampEntry[];
  readonly backoff?: { readonly pct: number; readonly sets: number; readonly reps: number };
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE BUILDER
// ═══════════════════════════════════════════════════════════════════════

function buildFasePN(): readonly ProgramDay[] {
  const days: ProgramDay[] = [];

  // ── Squat PN ramping scheme ──
  // Blocco 1 (weeks 1-5)
  const squatPnB1: readonly SquatPnWeek[] = [
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
    // Week 2
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
    // Week 3
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
    // Week 4 (eccentric focus)
    {
      ramps: [
        { pct: 0.4, sets: 2, reps: 4 },
        { pct: 0.475, sets: 2, reps: 3 },
        { pct: 0.55, sets: 4, reps: 2 },
      ],
    },
    // Week 5 (Reggio)
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
  const squatPnB2: readonly SquatPnWeek[] = [
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
  const squatPnTransition: readonly SquatPnWeek[] = [
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

  const allSquatPn: readonly SquatPnWeek[] = [...squatPnB1, ...squatPnB2, ...squatPnTransition];

  // ── Bench PN scheme (pin/board wave loading) ──
  const benchPnPcts = [
    0.55, 0.57, 0.59, 0.6, 0.62, 0.64, 0.65, 0.67, 0.69, 0.7, 0.72, 0.74, 0.75,
  ] as const;

  // ── Deadlift PN scheme ──
  const dlPnPcts = [
    0.55, 0.57, 0.59, 0.6, 0.62, 0.6, 0.62, 0.64, 0.65, 0.67, 0.65, 0.67, 0.7,
  ] as const;
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
  const dlElevPcts = [
    0.6, 0.62, 0.64, 0.65, 0.67, 0.62, 0.64, 0.66, 0.67, 0.69, 0.66, 0.68, 0.7,
  ] as const;

  // Pin squat Day 3 percentages
  const pinSquatPnPcts = [
    0.4, 0.42, 0.44, 0.45, 0.47, 0.44, 0.46, 0.48, 0.5, 0.52, 0.5, 0.52, 0.55,
  ] as const;

  for (let week = 1; week <= 13; week++) {
    const w = week - 1;
    const squatWeek = allSquatPn[w];
    const blocco = week <= 5 ? 1 : week <= 10 ? 2 : 3;

    // Day 1: Squat main (ramping) + Bench wave + Deadlift
    const squatSlots: SlotDef[] = squatWeek.ramps.map(
      (r: RampEntry, i: number): SlotDef =>
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

// ═══════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════

export const SALA_2_DEFINITION_JSONB = {
  configTitle: 'La Sala del Tiempo 2 — Potenziamento Neurale',
  configDescription:
    'Fase Due: Potenziamento Neurale. 13 semanas de potenciacion neural ' +
    'con cargas progresivas (60-95% TM). Transfiere la tecnica aprendida ' +
    'a cargas cada vez mas pesadas. 4 dias/semana.\n\n' +
    'Training Max: es el peso que puedes levantar con buena tecnica (~90% de tu 1RM). ' +
    'Deberias haber completado la Fase T1 antes de comenzar esta fase.',
  configEditTitle: 'Editar Training Max (kg)',
  configEditDescription:
    'Actualiza tu Training Max — el programa se recalculara con los nuevos valores.',
  cycleLength: 52,
  totalWorkouts: 52,
  workoutsPerWeek: 4,
  exercises: {
    squat: {},
    bench: {},
    deadlift: {},
    incline_db_press: {},
    one_arm_row: {},
    bench_board: {},
    bench_pin: {},
    deadlift_elevated: {},
    apert: {},
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
      hint: '~90% de tu 1RM con buena tecnica.',
    },
    {
      key: 'bench_tm',
      label: 'Press Banca (Training Max)',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'Training Max',
      hint: '~90% de tu 1RM con buena tecnica.',
    },
    {
      key: 'deadlift_tm',
      label: 'Peso Muerto (Training Max)',
      type: 'weight',
      min: 20,
      step: 2.5,
      group: 'Training Max',
      hint: '~90% de tu 1RM con buena tecnica.',
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
  days: [...buildFasePN()],
};
