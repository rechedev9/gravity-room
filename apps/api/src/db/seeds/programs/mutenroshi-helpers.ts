// Helper functions for generating the MUTENROSHI (Fase Zero — Incipit) program definition.
// Builds 200 unique days with 4 blocks each: core, activation, proprioception, fundamental.

import type { SlotDef } from './shared';
import { NC } from './shared';

// ── Volume cycle (6-week repeating pattern for Block 4 fundamentals) ──

export const VOLUME_CYCLE: readonly { readonly sets: number; readonly reps: number }[] = [
  { sets: 6, reps: 5 }, // Week 1
  { sets: 6, reps: 5 }, // Week 2
  { sets: 5, reps: 4 }, // Week 3
  { sets: 5, reps: 4 }, // Week 4
  { sets: 3, reps: 5 }, // Week 5 (relative deload)
  { sets: 5, reps: 4 }, // Week 6
];

// ── Focus type (day within each week) ──

type Focus = 'squat' | 'bench' | 'deadlift';

// ── Exercise notes from the book ──

const NOTES = {
  // Block 1 — Core
  plank:
    'Codos en suelo o brazos extendidos. Caderas alineadas con el tronco. 30s-1min isometria. Focus en sentir el contacto de todo el cuerpo con el pavimento.',
  reverse_plank:
    'Boca arriba. Espalda bien apoyada en el suelo. 30s-1min isometria. Estabilidad y eficacia del core.',
  sit_up_decline:
    'Movimiento parcial. Focus en mantener la panza compacta, no subir del todo. 10-15 reps.',

  // Block 2 — Squat/DL Activation
  leg_curl_prone:
    'Movimiento parcial. Enganchar femorales a traves de la presion del tobillo/gemelo contra el cojin. Sin buscar contraccion maxima. Los posteriores son los musculos mas dificiles de involucrar en sentadilla y peso muerto.',
  hyperextension:
    'Rodillas ligeramente flexionadas. Implicar femorales a traves de la presion del pie.',

  // Block 2 — Bench Activation
  lateral_raise_band:
    'Sentado. Movimiento controlado. Los elasticos crean una resistencia progresiva ideal para esta fase.',
  french_press_bench: 'Manos en linea con la frente. Triceps aislados.',
  rear_delt_band:
    'Codos ligeramente flexionados y BLOQUEADOS: la articulacion del codo no se abre ni se cierra. Traccionar el elastico hacia afuera, como si lo fueses a romper. Focus en el pecho que sube y se acerca al elastico.',

  // Block 3 — Squat Proprioception
  bulgarian_split_squat_slow:
    'Peso distribuido en el talon/todo el pie. Movimientos lentos e isometrias en el punto mas profundo.',
  calf_raise_proprioceptive:
    'De pie sobre una elevacion. Empieza con rodilla y tobillo FLEXIONADOS. Focus en empujar el avampiede contra el suelo. Extension de rodilla y tobillo simultanea. NO contraer el gemelo voluntariamente en la subida.',

  // Block 3 — Bench Proprioception
  pulley_band_seated:
    'Busto neutro. Abdomen relajado. Escapulas absolutamente neutras antes de iniciar la traccion. Movimiento de traccion parcial.',
  pushup_isometric:
    'En el suelo. Codos ligeramente flexionados y BLOQUEADOS. Mantener 20-30s completamente inmovil, equilibrando el peso sin subir ni bajar. Focus en EMPUJAR contra el pavimento.',

  // Block 3 — DL Proprioception
  deadlift_partial_blocks:
    'Piernas semiextendidas. Partida desde bloques (altura segun tu movilidad). Movimiento parcial de arriba hacia abajo hasta la rodilla. Peso del cuerpo en el avampiede.',
  leg_press_isometric:
    'Isometria hasta 1 minuto. Inmovil con rodillas ligeramente flexionadas. Focus TOTAL en el apoyo del pie: sin torsiones de tobillo ni rodilla, pie plano uniforme.',

  // Block 4 — Fundamentals (bodyweight)
  squat_bodyweight:
    'Movimiento LENTO. 5s descenso, percibiendo TODO el pie en contacto con el pavimento. 2-5s pausa en el punto mas bajo. 5s subida manteniendo siempre el Punto de Contacto con el suelo.',
  bench_pushups:
    'El bilanciere NO se toca en esta fase. Flexiones: de rodillas al principio, movimiento PARCIAL (no bajar el pecho al suelo), isometria a mitad del recorrido.',
  deadlift_isometric:
    'Posicion de partida del peso muerto. Mantener en ISOMETRIA 30s-1min. Inmovil. Despues, alzarse lentamente (5s de subida). El peso muerto es alzarse de pie, NO tirar.',

  // Block 4 — Fundamentals (loaded)
  squat_barbell:
    'Mismo tempo y focus que a peso corporal: 5s bajada, 2s pausa, 5s subida. El peso debe ser GESTIBLE: si la tecnica se deteriora, baja la carga.',
  bench_press_barbell:
    'Introducir gradualmente. Mantener el focus en el punto de contacto de las manos con la barra y la sensacion de empuje.',
  deadlift_barbell:
    'Estilo CLASICO (convencional) recomendado en esta fase. Mantener la idea de alzarse, no tirar.',
} as const;

// ── Slot factory functions ──

let slotCounter = 0;

function nextSlotId(prefix: string): string {
  slotCounter += 1;
  return `${prefix}_${slotCounter}`;
}

/**
 * Reset the slot counter. Call before building all 200 days
 * to ensure deterministic slot IDs.
 */
export function resetSlotCounter(): void {
  slotCounter = 0;
}

/** Create a core block slot (Block 1). No progression, bodyweight. */
export function coreSlot(exerciseId: string, notes: string): SlotDef {
  return {
    id: nextSlotId('core'),
    exerciseId,
    tier: 'core',
    stages: [{ sets: 3, reps: 1 }],
    onSuccess: NC,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: 'bodyweight',
    role: 'accessory',
    notes,
  };
}

/** Create an activation block slot (Block 2). No progression, bodyweight/bands. */
export function activationSlot(exerciseId: string, notes: string): SlotDef {
  return {
    id: nextSlotId('act'),
    exerciseId,
    tier: 'activation',
    stages: [{ sets: 4, reps: 10 }],
    onSuccess: NC,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: 'bodyweight',
    role: 'accessory',
    notes,
  };
}

/** Create a proprioception block slot (Block 3). No progression, bodyweight. */
export function proprioceptionSlot(exerciseId: string, notes: string): SlotDef {
  return {
    id: nextSlotId('prop'),
    exerciseId,
    tier: 'proprioception',
    stages: [{ sets: 3, reps: 10 }],
    onSuccess: NC,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: 'bodyweight',
    role: 'accessory',
    notes,
  };
}

/** Create a fundamental block slot (Block 4). No auto-progression (user decides weight). */
export function fundamentalSlot(
  exerciseId: string,
  startWeightKey: string,
  sets: number,
  reps: number,
  notes: string
): SlotDef {
  return {
    id: nextSlotId('fund'),
    exerciseId,
    tier: 'fundamental',
    stages: [{ sets, reps }],
    onSuccess: NC,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey,
    role: 'primary',
    notes,
  };
}

// ── Block builders ──

/** Block 1 — Core Strengthening (same for all days) */
function coreBlock(): readonly SlotDef[] {
  return [
    coreSlot('plank', NOTES.plank),
    coreSlot('reverse_plank', NOTES.reverse_plank),
    coreSlot('sit_up_decline', NOTES.sit_up_decline),
  ];
}

/** Block 2 — Muscle Activation (varies by focus) */
function activationBlock(focus: Focus): readonly SlotDef[] {
  switch (focus) {
    case 'squat':
      return [
        activationSlot('leg_curl_prone', NOTES.leg_curl_prone),
        activationSlot('hyperextension', NOTES.hyperextension),
      ];
    case 'bench':
      return [
        activationSlot('lateral_raise_band', NOTES.lateral_raise_band),
        activationSlot('french_press_bench', NOTES.french_press_bench),
        activationSlot('rear_delt_band', NOTES.rear_delt_band),
      ];
    case 'deadlift':
      return [
        activationSlot('leg_curl_prone', NOTES.leg_curl_prone),
        activationSlot('hyperextension', NOTES.hyperextension),
      ];
  }
}

/** Block 3 — Proprioception & Coordination (varies by focus) */
function proprioceptionBlock(focus: Focus): readonly SlotDef[] {
  switch (focus) {
    case 'squat':
      return [
        proprioceptionSlot('bulgarian_split_squat_slow', NOTES.bulgarian_split_squat_slow),
        proprioceptionSlot('calf_raise_proprioceptive', NOTES.calf_raise_proprioceptive),
      ];
    case 'bench':
      return [
        proprioceptionSlot('pulley_band_seated', NOTES.pulley_band_seated),
        proprioceptionSlot('pushup_isometric', NOTES.pushup_isometric),
      ];
    case 'deadlift':
      return [
        proprioceptionSlot('deadlift_partial_blocks', NOTES.deadlift_partial_blocks),
        proprioceptionSlot('leg_press_isometric', NOTES.leg_press_isometric),
      ];
  }
}

/** Block 4 — The Fundamental (varies by focus AND phase) */
function fundamentalBlock(
  focus: Focus,
  isLoaded: boolean,
  sets: number,
  reps: number
): readonly SlotDef[] {
  if (isLoaded) {
    switch (focus) {
      case 'squat':
        return [fundamentalSlot('squat_barbell', 'squat_start', sets, reps, NOTES.squat_barbell)];
      case 'bench':
        return [
          fundamentalSlot(
            'bench_press_barbell',
            'bench_start',
            sets,
            reps,
            NOTES.bench_press_barbell
          ),
        ];
      case 'deadlift':
        return [
          fundamentalSlot('deadlift_barbell', 'deadlift_start', sets, reps, NOTES.deadlift_barbell),
        ];
    }
  }

  // Bodyweight phase
  switch (focus) {
    case 'squat':
      return [
        fundamentalSlot('squat_bodyweight', 'bodyweight', sets, reps, NOTES.squat_bodyweight),
      ];
    case 'bench':
      return [fundamentalSlot('bench_pushups', 'bodyweight', sets, reps, NOTES.bench_pushups)];
    case 'deadlift':
      return [
        fundamentalSlot('deadlift_isometric', 'bodyweight', sets, reps, NOTES.deadlift_isometric),
      ];
  }
}

// ── Day generator ──

/** Focus rotation: dayIndex % 3 determines the focus. */
function focusForDay(dayIndex: number): Focus {
  const remainder = dayIndex % 3;
  if (remainder === 0) return 'squat';
  if (remainder === 1) return 'bench';
  return 'deadlift';
}

const FOCUS_LABELS: Readonly<Record<Focus, string>> = {
  squat: 'SQUAT',
  bench: 'BENCH',
  deadlift: 'DEADLIFT',
};

/**
 * Generate a complete day structure with 4 blocks.
 *
 * @param dayIndex - 0-based day index (0..199)
 *   - Days 0-11: bodyweight phase (first 4 weeks)
 *   - Days 12+: loaded phase (week 5+)
 * @returns Object with name and slots array for ProgramDaySchema
 */
export function mutenroshiDay(dayIndex: number): {
  readonly name: string;
  readonly slots: readonly SlotDef[];
} {
  const focus = focusForDay(dayIndex);
  const weekIndex = Math.floor(dayIndex / 3);
  const isLoaded = dayIndex >= 12; // Days 12+ = week 5+
  const volume = VOLUME_CYCLE[weekIndex % VOLUME_CYCLE.length];

  const dayNumber = dayIndex + 1;
  const weekNumber = weekIndex + 1;
  const name = `Semana ${weekNumber} - Dia ${dayNumber} (${FOCUS_LABELS[focus]})`;

  const slots: SlotDef[] = [
    ...coreBlock(),
    ...activationBlock(focus),
    ...proprioceptionBlock(focus),
    ...fundamentalBlock(focus, isLoaded, volume.sets, volume.reps),
  ];

  return { name, slots };
}
