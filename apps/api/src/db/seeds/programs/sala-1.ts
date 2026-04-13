// sala-1.ts — "La Sala del Tiempo 1" (Fase Uno: Perfezionamento Tecnico)
// 24 workouts, 6 weeks x 4 days/week
//
// Standalone T1 phase extracted from brunetti-365.ts.
// Slow movements, isometrics, technical perfection at 40-70% TM.

import type { ProgramDay } from './shared';
import { BRUNETTI_TM, TEMPO_D5F2S5, tmNcSlot, flatNcSlot } from './shared';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

const TM = BRUNETTI_TM;

// ═══════════════════════════════════════════════════════════════════════
// PHASE BUILDER
// ═══════════════════════════════════════════════════════════════════════

function buildFaseT1(): readonly ProgramDay[] {
  const days: ProgramDay[] = [];

  // Week-by-week squat % for Day 1 (slow tempo work)
  const squatD1Pcts = [0.4, 0.45, 0.5, 0.4, 0.5, 0.55] as const;
  const squatD1Volume: readonly { readonly sets: number; readonly reps: number }[] = [
    { sets: 10, reps: 4 },
    { sets: 10, reps: 4 },
    { sets: 10, reps: 4 },
    { sets: 10, reps: 4 },
    { sets: 10, reps: 4 },
    { sets: 8, reps: 3 }, // Week 6: intensity increase
  ];

  // Bench wave loading on Day 1: simplified representation
  // Week 1-3 (Blocco 1): 50% range, Week 4-6 (Blocco 2): 55% range
  const benchD1Pcts = [0.5, 0.5, 0.5, 0.55, 0.55, 0.55] as const;

  // Deadlift Day 1 %
  const dlD1Pcts = [0.55, 0.55, 0.6, 0.6, 0.65, 0.65] as const;
  const dlD1Volume: readonly { readonly sets: number; readonly reps: number }[] = [
    { sets: 5, reps: 5 },
    { sets: 5, reps: 5 },
    { sets: 4, reps: 6 },
    { sets: 4, reps: 6 },
    { sets: 6, reps: 4 },
    { sets: 6, reps: 4 },
  ];

  // Bench board/pin Day 2 %
  const benchD2Pcts = [0.7, 0.72, 0.75, 0.75, 0.78, 0.8] as const;
  const benchD2Volume: readonly { readonly sets: number; readonly reps: number }[] = [
    { sets: 6, reps: 3 },
    { sets: 6, reps: 3 },
    { sets: 5, reps: 3 },
    { sets: 5, reps: 3 },
    { sets: 4, reps: 3 },
    { sets: 4, reps: 3 },
  ];

  // Deadlift from blocks Day 2
  const dlBlocksPcts = [0.55, 0.58, 0.6, 0.6, 0.63, 0.65] as const;

  // Deadlift Day 3 main %
  const dlD3Pcts = [0.55, 0.58, 0.6, 0.6, 0.63, 0.65] as const;
  const dlD3Volume: readonly { readonly sets: number; readonly reps: number }[] = [
    { sets: 4, reps: 4 },
    { sets: 4, reps: 4 },
    { sets: 3, reps: 3 },
    { sets: 3, reps: 3 },
    { sets: 4, reps: 3 },
    { sets: 4, reps: 3 },
  ];

  // Pin squat Day 3 %
  const pinSquatPcts = [0.4, 0.45, 0.5, 0.5, 0.55, 0.6] as const;

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

// ═══════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════

export const SALA_1_DEFINITION_JSONB = {
  configTitle: 'La Sala del Tiempo 1 — Perfezionamento Tecnico',
  configDescription:
    'Fase Uno: Perfezionamento Tecnico. 6 semanas de perfeccionamiento tecnico ' +
    'con cargas moderadas (40-70% TM). Movimientos lentos, isometrias, ' +
    'control de cada centimetro. 4 dias/semana.\n\n' +
    'Training Max: es el peso que puedes levantar con buena tecnica (~90% de tu 1RM). ' +
    'Si no conoces tu maximo, estima conservadoramente — el objetivo es practica tecnica, no fuerza.',
  configEditTitle: 'Editar Training Max (kg)',
  configEditDescription:
    'Actualiza tu Training Max — el programa se recalculara con los nuevos valores.',
  cycleLength: 24,
  totalWorkouts: 24,
  workoutsPerWeek: 4,
  exercises: {
    squat: {},
    bench: {},
    deadlift: {},
    incline_db_press: {},
    one_arm_row: {},
    bench_board: {},
    bench_pin: {},
    deadlift_partial_blocks: {},
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
  days: [...buildFaseT1()],
};
