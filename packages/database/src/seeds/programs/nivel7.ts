import type { SlotDef } from './shared';
import { NC, ADV } from './shared';

type Cycle = 'c1' | 'c2';
type Phase = 'b1' | 'b1d' | 'b2';

const PHASE_OFFSETS: Readonly<Record<Cycle, Readonly<Record<Phase, number>>>> = {
  c1: { b1: 4, b1d: 4, b2: 2 },
  c2: { b1: 3, b1d: 3, b2: 1 },
};

function n7Main(
  exerciseId: string,
  cycle: Cycle,
  phase: Phase,
  sets: number,
  reps: number
): SlotDef {
  const isDeload = phase === 'b1d';
  return {
    id: `${exerciseId}-${cycle}${phase}`,
    exerciseId,
    tier: 't1',
    stages: [{ sets, reps }],
    onSuccess: isDeload ? NC : { type: 'add_weight' },
    onUndefined: isDeload ? NC : { type: 'add_weight' },
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: exerciseId,
    startWeightOffset: PHASE_OFFSETS[cycle][phase],
  };
}

function n7Acc(exerciseId: string, tier: string): SlotDef {
  return {
    id: exerciseId,
    exerciseId,
    tier,
    stages: [
      { sets: 3, reps: 8 },
      { sets: 3, reps: 9 },
      { sets: 3, reps: 10 },
      { sets: 3, reps: 11 },
      { sets: 3, reps: 12 },
    ],
    onSuccess: ADV,
    onFinalStageSuccess: { type: 'add_weight_reset_stage', amount: 2.5 },
    onUndefined: ADV,
    onMidStageFail: NC,
    onFinalStageFail: NC,
    startWeightKey: exerciseId,
  };
}

function n7CycleDays(
  cycle: Cycle
): readonly { readonly name: string; readonly slots: readonly SlotDef[] }[] {
  const ml = (exerciseId: string, phase: Phase, sets: number, reps: number): SlotDef =>
    n7Main(exerciseId, cycle, phase, sets, reps);

  return [
    // Block 1 — Week 1
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        ml('press_mil', 'b1', 5, 5),
        n7Acc('press_franc', 't2'),
        n7Acc('ext_polea', 't3'),
        n7Acc('elev_lat', 't3'),
        n7Acc('elev_post', 't3'),
      ],
    },
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        ml('deadlift', 'b1', 1, 5),
        n7Acc('remo_bar', 't2'),
        n7Acc('jalon', 't2'),
        n7Acc('face_pull', 't3'),
        n7Acc('gemelo_pie', 't3'),
        n7Acc('gemelo_sent', 't3'),
      ],
    },
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        ml('bench', 'b1', 5, 5),
        n7Acc('apert', 't2'),
        n7Acc('cruces', 't3'),
        n7Acc('curl_bar', 't2'),
        n7Acc('curl_alt', 't3'),
      ],
    },
    {
      name: 'Vie — Pierna',
      slots: [
        ml('squat', 'b1', 5, 5),
        n7Acc('prensa', 't2'),
        n7Acc('ext_quad', 't3'),
        n7Acc('curl_fem', 't3'),
        n7Acc('hip_thrust', 't2'),
      ],
    },
    // Block 1 — Week 2
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        ml('press_mil', 'b1', 5, 5),
        n7Acc('press_franc', 't2'),
        n7Acc('ext_polea', 't3'),
        n7Acc('elev_lat', 't3'),
        n7Acc('elev_front', 't3'),
      ],
    },
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        ml('deadlift', 'b1', 1, 5),
        n7Acc('remo_bar', 't2'),
        n7Acc('jalon', 't2'),
        n7Acc('face_pull', 't3'),
        n7Acc('gemelo_pie', 't3'),
        n7Acc('gemelo_sent', 't3'),
      ],
    },
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        ml('bench', 'b1', 5, 5),
        n7Acc('apert', 't2'),
        n7Acc('cruces', 't3'),
        n7Acc('curl_bar', 't2'),
        n7Acc('curl_mart', 't3'),
      ],
    },
    {
      name: 'Vie — Pierna',
      slots: [
        ml('squat', 'b1', 5, 5),
        n7Acc('prensa', 't2'),
        n7Acc('ext_quad', 't3'),
        n7Acc('curl_fem', 't3'),
        n7Acc('zancadas', 't2'),
      ],
    },
    // Block 1 — Week 3 (deload)
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        ml('press_mil', 'b1d', 5, 5),
        n7Acc('press_franc', 't2'),
        n7Acc('ext_polea', 't3'),
        n7Acc('elev_lat', 't3'),
        n7Acc('elev_post', 't3'),
      ],
    },
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        ml('deadlift', 'b1d', 1, 5),
        n7Acc('remo_bar', 't2'),
        n7Acc('jalon', 't2'),
        n7Acc('face_pull', 't3'),
        n7Acc('gemelo_pie', 't3'),
        n7Acc('gemelo_sent', 't3'),
      ],
    },
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        ml('bench', 'b1d', 5, 5),
        n7Acc('apert', 't2'),
        n7Acc('cruces', 't3'),
        n7Acc('curl_bar', 't2'),
        n7Acc('curl_alt', 't3'),
      ],
    },
    {
      name: 'Vie — Pierna',
      slots: [
        ml('squat', 'b1d', 5, 5),
        n7Acc('prensa', 't2'),
        n7Acc('ext_quad', 't3'),
        n7Acc('curl_fem', 't3'),
        n7Acc('leg_press_gem', 't3'),
      ],
    },
    // Block 2 — Week 4
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        ml('press_mil', 'b2', 3, 3),
        n7Acc('press_franc', 't2'),
        n7Acc('ext_polea', 't3'),
        n7Acc('elev_lat', 't3'),
        n7Acc('elev_post', 't3'),
      ],
    },
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        ml('deadlift', 'b2', 1, 3),
        n7Acc('remo_bar', 't2'),
        n7Acc('jalon', 't2'),
        n7Acc('face_pull', 't3'),
        n7Acc('gemelo_pie', 't3'),
        n7Acc('gemelo_sent', 't3'),
      ],
    },
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        ml('bench', 'b2', 3, 3),
        n7Acc('apert', 't2'),
        n7Acc('cruces', 't3'),
        n7Acc('curl_bar', 't2'),
        n7Acc('curl_alt', 't3'),
      ],
    },
    {
      name: 'Vie — Pierna',
      slots: [
        ml('squat', 'b2', 3, 3),
        n7Acc('prensa', 't2'),
        n7Acc('ext_quad', 't3'),
        n7Acc('curl_fem', 't3'),
        n7Acc('hip_thrust', 't2'),
      ],
    },
    // Block 2 — Week 5
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        ml('press_mil', 'b2', 3, 3),
        n7Acc('press_franc', 't2'),
        n7Acc('ext_polea', 't3'),
        n7Acc('elev_lat', 't3'),
        n7Acc('elev_front', 't3'),
      ],
    },
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        ml('deadlift', 'b2', 1, 3),
        n7Acc('remo_bar', 't2'),
        n7Acc('jalon', 't2'),
        n7Acc('face_pull', 't3'),
        n7Acc('gemelo_pie', 't3'),
        n7Acc('gemelo_sent', 't3'),
      ],
    },
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        ml('bench', 'b2', 3, 3),
        n7Acc('apert', 't2'),
        n7Acc('cruces', 't3'),
        n7Acc('curl_bar', 't2'),
        n7Acc('curl_mart', 't3'),
      ],
    },
    {
      name: 'Vie — Pierna',
      slots: [
        ml('squat', 'b2', 3, 3),
        n7Acc('prensa', 't2'),
        n7Acc('ext_quad', 't3'),
        n7Acc('curl_fem', 't3'),
        n7Acc('zancadas', 't2'),
      ],
    },
    // Block 2 — Week 6 (record)
    {
      name: 'Lun — Hombros/Tríceps',
      slots: [
        ml('press_mil', 'b2', 3, 3),
        n7Acc('press_franc', 't2'),
        n7Acc('ext_polea', 't3'),
        n7Acc('elev_lat', 't3'),
        n7Acc('elev_post', 't3'),
      ],
    },
    {
      name: 'Mar — Espalda/Gemelo',
      slots: [
        ml('deadlift', 'b2', 1, 3),
        n7Acc('remo_bar', 't2'),
        n7Acc('jalon', 't2'),
        n7Acc('face_pull', 't3'),
        n7Acc('gemelo_pie', 't3'),
        n7Acc('gemelo_sent', 't3'),
      ],
    },
    {
      name: 'Jue — Pecho/Bíceps',
      slots: [
        ml('bench', 'b2', 3, 3),
        n7Acc('apert', 't2'),
        n7Acc('cruces', 't3'),
        n7Acc('curl_bar', 't2'),
        n7Acc('curl_alt', 't3'),
      ],
    },
    {
      name: 'Vie — Pierna',
      slots: [
        ml('squat', 'b2', 3, 3),
        n7Acc('prensa', 't2'),
        n7Acc('ext_quad', 't3'),
        n7Acc('curl_fem', 't3'),
        n7Acc('leg_press_gem', 't3'),
      ],
    },
  ];
}

export const NIVEL7_DEFINITION_JSONB = {
  configTitle: 'Récords Objetivo (kg)',
  configDescription:
    'Configura el récord que quieres alcanzar en la semana 6 para los levantamientos principales, ' +
    'y el peso inicial de los accesorios.',
  configEditTitle: 'Editar Récords Objetivo (kg)',
  configEditDescription:
    'Actualiza tus récords objetivo — el programa se recalculará con los nuevos valores.',
  cycleLength: 48,
  totalWorkouts: 48,
  workoutsPerWeek: 4,
  exercises: {
    press_mil: {},
    bench: {},
    squat: {},
    deadlift: {},
    press_franc: {},
    ext_polea: {},
    elev_lat: {},
    elev_post: {},
    remo_bar: {},
    jalon: {},
    face_pull: {},
    gemelo_pie: {},
    gemelo_sent: {},
    apert: {},
    cruces: {},
    curl_bar: {},
    curl_alt: {},
    curl_mart: {},
    prensa: {},
    ext_quad: {},
    curl_fem: {},
    hip_thrust: {},
    zancadas: {},
    leg_press_gem: {},
    elev_front: {},
  },
  configFields: [
    {
      key: 'press_mil',
      label: 'Press Militar (récord sem. 6)',
      type: 'weight',
      min: 2.5,
      step: 2.5,
      group: 'Objetivos principales (sem. 6)',
    },
    {
      key: 'bench',
      label: 'Press Banca (récord sem. 6)',
      type: 'weight',
      min: 2.5,
      step: 2.5,
      group: 'Objetivos principales (sem. 6)',
    },
    {
      key: 'squat',
      label: 'Sentadilla (récord sem. 6)',
      type: 'weight',
      min: 2.5,
      step: 2.5,
      group: 'Objetivos principales (sem. 6)',
    },
    {
      key: 'deadlift',
      label: 'Peso Muerto (récord sem. 6)',
      type: 'weight',
      min: 2.5,
      step: 2.5,
      group: 'Objetivos principales (sem. 6)',
    },
    {
      key: 'press_franc',
      label: 'Press Francés',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Hombros / Triceps',
    },
    {
      key: 'ext_polea',
      label: 'Extensión Polea',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Hombros / Triceps',
    },
    {
      key: 'elev_lat',
      label: 'Elevaciones Laterales',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Hombros / Triceps',
    },
    {
      key: 'elev_post',
      label: 'Elevaciones Posteriores',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Hombros / Triceps',
    },
    {
      key: 'elev_front',
      label: 'Elevaciones Frontales',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Hombros / Triceps',
    },
    {
      key: 'remo_bar',
      label: 'Remo con Barra',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Espalda / Gemelo',
    },
    {
      key: 'jalon',
      label: 'Jalón al Pecho',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Espalda / Gemelo',
    },
    {
      key: 'face_pull',
      label: 'Face Pull',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Espalda / Gemelo',
    },
    {
      key: 'gemelo_pie',
      label: 'Gemelo de Pie',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Espalda / Gemelo',
    },
    {
      key: 'gemelo_sent',
      label: 'Gemelo Sentado',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Espalda / Gemelo',
    },
    {
      key: 'apert',
      label: 'Aperturas',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Pecho / Biceps',
    },
    {
      key: 'cruces',
      label: 'Cruces en Polea',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Pecho / Biceps',
    },
    {
      key: 'curl_bar',
      label: 'Curl con Barra',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Pecho / Biceps',
    },
    {
      key: 'curl_alt',
      label: 'Curl Alterno',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Pecho / Biceps',
    },
    {
      key: 'curl_mart',
      label: 'Curl Martillo',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Pecho / Biceps',
    },
    { key: 'prensa', label: 'Prensa', type: 'weight', min: 0, step: 0.5, group: 'Pierna' },
    {
      key: 'ext_quad',
      label: 'Extensión Cuádriceps',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Pierna',
    },
    { key: 'curl_fem', label: 'Curl Femoral', type: 'weight', min: 0, step: 0.5, group: 'Pierna' },
    { key: 'hip_thrust', label: 'Hip Thrust', type: 'weight', min: 0, step: 0.5, group: 'Pierna' },
    { key: 'zancadas', label: 'Zancadas', type: 'weight', min: 0, step: 0.5, group: 'Pierna' },
    {
      key: 'leg_press_gem',
      label: 'Prensa Gemelo',
      type: 'weight',
      min: 0,
      step: 0.5,
      group: 'Pierna',
    },
  ],
  weightIncrements: {
    press_mil: 2.5,
    bench: 2.5,
    squat: 2.5,
    deadlift: 2.5,
  },
  days: [...n7CycleDays('c1'), ...n7CycleDays('c2')],
};
