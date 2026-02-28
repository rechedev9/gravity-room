// MUTENROSHI (Caparazón de Tortuga) program definition.
// 200 workouts, 3 sessions/week, 4 blocks per session.
// Author: Amerigo Brunetti ("365 Programmare L'Ipertrofia")

import { mutenroshiDay, resetSlotCounter } from './mutenroshi-helpers';

const TOTAL_WORKOUTS = 200;

// Reset counter before building all days for deterministic slot IDs
resetSlotCounter();

const days: ReturnType<typeof mutenroshiDay>[] = [];
for (let i = 0; i < TOTAL_WORKOUTS; i++) {
  days.push(mutenroshiDay(i));
}

export const MUTENROSHI_DEFINITION_JSONB = {
  id: 'mutenroshi',
  name: 'Caparaz\u00f3n de Tortuga',
  description:
    'Antes de luchar en el Tenkaichi Budokai, Goku y Krillin tuvieron que repartir leche, ' +
    'arar campos y correr con el caparaz\u00f3n de tortuga a cuestas. Este programa ' +
    'de Amerigo Brunetti (365 Programmare L\u2019Ipertrofia) es tu propio entrenamiento ' +
    'en la Kame House: empiezas desde cero \u2014 solo tu cuerpo y la barra vac\u00eda ' +
    'con movimientos muy lentos \u2014 y poco a poco vas a\u00f1adiendo peso. ' +
    'Cuando domines Sentadilla, Press de Banca y Peso Muerto, estar\u00e1s listo para el torneo.',
  author: 'Amerigo Brunetti',
  version: 1,
  category: 'beginner',
  source: 'preset',
  displayMode: 'blocks',
  totalWorkouts: TOTAL_WORKOUTS,
  workoutsPerWeek: 3,
  cycleLength: TOTAL_WORKOUTS,
  days,
  configFields: [
    // Group: Tu informacion
    {
      key: 'bodyweight',
      label: 'Peso corporal (kg)',
      type: 'weight',
      min: 30,
      step: 0.5,
      group: 'Tu informacion',
    },
    {
      key: 'gender',
      label: 'Genero (para calcular objetivos)',
      type: 'select',
      options: [
        { value: 'male', label: 'Hombre (objetivo: peso corporal en barra)' },
        { value: 'female', label: 'Mujer (objetivo: 70% peso corporal en barra)' },
      ],
      group: 'Tu informacion',
    },
    // Group: Configuracion
    {
      key: 'rounding',
      label: 'Redondeo de pesos',
      type: 'select',
      options: [
        { value: '2.5', label: '2.5 kg' },
        { value: '1.25', label: '1.25 kg' },
      ],
      group: 'Configuracion',
    },
    // Group: Starting Loads (Week 5+)
    {
      key: 'squat_start',
      label: 'Sentadilla (peso inicial semana 5)',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Cargas iniciales (Semana 5+)',
    },
    {
      key: 'bench_start',
      label: 'Press Banca (peso inicial semana 5)',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Cargas iniciales (Semana 5+)',
    },
    {
      key: 'deadlift_start',
      label: 'Peso Muerto (peso inicial semana 5)',
      type: 'weight',
      min: 0,
      step: 2.5,
      group: 'Cargas iniciales (Semana 5+)',
    },
  ],
  weightIncrements: {
    bodyweight: 0,
    squat_start: 2.5,
    bench_start: 2.5,
    deadlift_start: 2.5,
  },
  exercises: {
    // Block 1 — Core
    plank: {},
    reverse_plank: {},
    sit_up_decline: {},
    // Block 2 — Activation
    leg_curl_prone: {},
    hyperextension: {},
    lateral_raise_band: {},
    french_press_bench: {},
    rear_delt_band: {},
    // Block 3 — Proprioception
    bulgarian_split_squat_slow: {},
    calf_raise_proprioceptive: {},
    pulley_band_seated: {},
    pushup_isometric: {},
    deadlift_partial_blocks: {},
    leg_press_isometric: {},
    // Block 4 — Fundamentals (bodyweight)
    squat_bodyweight: {},
    bench_pushups: {},
    deadlift_isometric: {},
    // Block 4 — Fundamentals (loaded)
    squat_barbell: {},
    bench_press_barbell: {},
    deadlift_barbell: {},
  },
  configTitle: 'Caparaz\u00f3n de Tortuga',
  configDescription:
    'Este programa es para ti si estas empezando desde cero con Sentadilla, Press de Banca y ' +
    'Peso Muerto, o si llevas poco tiempo y quieres asentar bien las bases tecnicas. ' +
    'Durante las primeras 4 semanas trabajaras solo con tu peso corporal o la barra vacia. ' +
    'A partir de la semana 5 empezaras a anadir peso poco a poco. ' +
    'Si ya tienes familiaridad con los tres ejercicios fundamentales con barra, puedes ' +
    'saltar esta fase e ir directamente al Protocollo JAW.',
};
