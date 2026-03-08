/**
 * Idempotent seed for the exercises table.
 * Source of truth for all canonical exercise IDs across all preset programs.
 * Uses onConflictDoNothing() to allow re-runs without error.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { exercises } from '../schema';
import type * as schema from '../schema';

type DbClient = PostgresJsDatabase<typeof schema>;

interface ExerciseSeed {
  readonly id: string;
  readonly name: string;
  readonly muscleGroupId: string;
  readonly equipment: string | null;
  readonly isCompound: boolean;
}

/**
 * Canonical exercise list — deduplicated across all preset programs.
 * Shared exercises (squat, bench, deadlift, ohp, face_pull, etc.) appear once.
 */
const CANONICAL_EXERCISES: readonly ExerciseSeed[] = [
  // ── Shared main lifts ──
  {
    id: 'squat',
    name: 'Sentadilla',
    muscleGroupId: 'legs',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'bench',
    name: 'Press Banca',
    muscleGroupId: 'chest',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'deadlift',
    name: 'Peso Muerto',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'ohp',
    name: 'Press Militar',
    muscleGroupId: 'shoulders',
    equipment: 'barbell',
    isCompound: true,
  },

  // ── GZCLP-only exercises ──
  {
    id: 'latpulldown',
    name: 'Jalón al Pecho',
    muscleGroupId: 'back',
    equipment: 'cable',
    isCompound: false,
  },
  {
    id: 'dbrow',
    name: 'Remo con Mancuernas',
    muscleGroupId: 'back',
    equipment: 'dumbbell',
    isCompound: true,
  },

  // ── PPL 5/3/1 exercises ──
  {
    id: 'pullup',
    name: 'Dominadas',
    muscleGroupId: 'back',
    equipment: 'bodyweight',
    isCompound: true,
  },
  {
    id: 'lat_pulldown',
    name: 'Jalon al Pecho',
    muscleGroupId: 'back',
    equipment: 'cable',
    isCompound: false,
  },
  {
    id: 'seated_row',
    name: 'Remo Sentado',
    muscleGroupId: 'back',
    equipment: 'cable',
    isCompound: true,
  },
  {
    id: 'face_pull',
    name: 'Face Pull',
    muscleGroupId: 'shoulders',
    equipment: 'cable',
    isCompound: false,
  },
  {
    id: 'hammer_curl',
    name: 'Curl Martillo',
    muscleGroupId: 'arms',
    equipment: 'dumbbell',
    isCompound: false,
  },
  {
    id: 'incline_curl',
    name: 'Curl Inclinado',
    muscleGroupId: 'arms',
    equipment: 'dumbbell',
    isCompound: false,
  },
  {
    id: 'bent_over_row',
    name: 'Remo con Barra',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'incline_row',
    name: 'Remo Inclinado',
    muscleGroupId: 'back',
    equipment: 'dumbbell',
    isCompound: true,
  },
  {
    id: 'lying_bicep_curl',
    name: 'Curl Tumbado',
    muscleGroupId: 'arms',
    equipment: 'dumbbell',
    isCompound: false,
  },
  {
    id: 'incline_db_press',
    name: 'Press Inclinado Mancuernas',
    muscleGroupId: 'chest',
    equipment: 'dumbbell',
    isCompound: true,
  },
  {
    id: 'triceps_pushdown',
    name: 'Extension Triceps Polea',
    muscleGroupId: 'arms',
    equipment: 'cable',
    isCompound: false,
  },
  {
    id: 'triceps_extension',
    name: 'Extension Triceps',
    muscleGroupId: 'arms',
    equipment: 'cable',
    isCompound: false,
  },
  {
    id: 'lateral_raise',
    name: 'Elevaciones Laterales',
    muscleGroupId: 'shoulders',
    equipment: 'dumbbell',
    isCompound: false,
  },
  {
    id: 'barbell_rdl',
    name: 'RDL con Barra',
    muscleGroupId: 'legs',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'dumbbell_rdl',
    name: 'RDL con Mancuernas',
    muscleGroupId: 'legs',
    equipment: 'dumbbell',
    isCompound: true,
  },
  {
    id: 'bulgarian_split_squat',
    name: 'Zancada Bulgara',
    muscleGroupId: 'legs',
    equipment: 'dumbbell',
    isCompound: true,
  },
  {
    id: 'cable_pull_through',
    name: 'Pull Through en Polea',
    muscleGroupId: 'legs',
    equipment: 'cable',
    isCompound: true,
  },
  {
    id: 'standing_calf_raise',
    name: 'Gemelo de Pie',
    muscleGroupId: 'calves',
    equipment: 'machine',
    isCompound: false,
  },
  {
    id: 'seated_leg_curl',
    name: 'Curl Femoral Sentado',
    muscleGroupId: 'legs',
    equipment: 'machine',
    isCompound: false,
  },

  // ── Nivel 7 exercises (unique to Nivel 7) ──
  {
    id: 'press_mil',
    name: 'Press Militar',
    muscleGroupId: 'shoulders',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'press_franc',
    name: 'Press Francés',
    muscleGroupId: 'arms',
    equipment: 'barbell',
    isCompound: false,
  },
  {
    id: 'ext_polea',
    name: 'Extensión Polea',
    muscleGroupId: 'arms',
    equipment: 'cable',
    isCompound: false,
  },
  {
    id: 'elev_lat',
    name: 'Elevaciones Laterales',
    muscleGroupId: 'shoulders',
    equipment: 'dumbbell',
    isCompound: false,
  },
  {
    id: 'elev_post',
    name: 'Elevaciones Posteriores',
    muscleGroupId: 'shoulders',
    equipment: 'dumbbell',
    isCompound: false,
  },
  {
    id: 'remo_bar',
    name: 'Remo con Barra',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'jalon',
    name: 'Jalón al Pecho',
    muscleGroupId: 'back',
    equipment: 'cable',
    isCompound: false,
  },
  {
    id: 'gemelo_pie',
    name: 'Gemelo de Pie',
    muscleGroupId: 'calves',
    equipment: 'machine',
    isCompound: false,
  },
  {
    id: 'gemelo_sent',
    name: 'Gemelo Sentado',
    muscleGroupId: 'calves',
    equipment: 'machine',
    isCompound: false,
  },
  {
    id: 'apert',
    name: 'Aperturas',
    muscleGroupId: 'chest',
    equipment: 'dumbbell',
    isCompound: false,
  },
  {
    id: 'cruces',
    name: 'Cruces en Polea',
    muscleGroupId: 'chest',
    equipment: 'cable',
    isCompound: false,
  },
  {
    id: 'curl_bar',
    name: 'Curl con Barra',
    muscleGroupId: 'arms',
    equipment: 'barbell',
    isCompound: false,
  },
  {
    id: 'curl_alt',
    name: 'Curl Alterno',
    muscleGroupId: 'arms',
    equipment: 'dumbbell',
    isCompound: false,
  },
  {
    id: 'curl_mart',
    name: 'Curl Martillo',
    muscleGroupId: 'arms',
    equipment: 'dumbbell',
    isCompound: false,
  },
  { id: 'prensa', name: 'Prensa', muscleGroupId: 'legs', equipment: 'machine', isCompound: true },
  {
    id: 'ext_quad',
    name: 'Extensión Cuádriceps',
    muscleGroupId: 'legs',
    equipment: 'machine',
    isCompound: false,
  },
  {
    id: 'curl_fem',
    name: 'Curl Femoral',
    muscleGroupId: 'legs',
    equipment: 'machine',
    isCompound: false,
  },
  {
    id: 'hip_thrust',
    name: 'Hip Thrust',
    muscleGroupId: 'legs',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'zancadas',
    name: 'Zancadas',
    muscleGroupId: 'legs',
    equipment: 'dumbbell',
    isCompound: true,
  },
  {
    id: 'leg_press_gem',
    name: 'Prensa Gemelo',
    muscleGroupId: 'calves',
    equipment: 'machine',
    isCompound: false,
  },
  {
    id: 'elev_front',
    name: 'Elevaciones Frontales',
    muscleGroupId: 'shoulders',
    equipment: 'dumbbell',
    isCompound: false,
  },

  // ── PPL A/B exercises ──
  {
    id: 'bench_machine',
    name: 'Press Banca en Maquina',
    muscleGroupId: 'chest',
    equipment: 'machine',
    isCompound: true,
  },
  {
    id: 'incline_press_smith',
    name: 'Press Inclinado en Smith',
    muscleGroupId: 'chest',
    equipment: 'machine',
    isCompound: true,
  },
  {
    id: 'pec_deck',
    name: 'Pec Deck',
    muscleGroupId: 'chest',
    equipment: 'machine',
    isCompound: false,
  },
  {
    id: 'incline_machine_press',
    name: 'Press Inclinado en Maquina',
    muscleGroupId: 'chest',
    equipment: 'machine',
    isCompound: true,
  },
  {
    id: 'shoulder_press_machine',
    name: 'Press Hombro en Maquina',
    muscleGroupId: 'shoulders',
    equipment: 'machine',
    isCompound: true,
  },
  {
    id: 'lat_pulldown_neutral',
    name: 'Jalon Agarre Neutro',
    muscleGroupId: 'back',
    equipment: 'cable',
    isCompound: false,
  },
  {
    id: 'gironda_row',
    name: 'Remo Gironda',
    muscleGroupId: 'back',
    equipment: 'cable',
    isCompound: true,
  },
  {
    id: 'machine_row',
    name: 'Remo en Maquina',
    muscleGroupId: 'back',
    equipment: 'machine',
    isCompound: true,
  },
  {
    id: 'machine_preacher_curl',
    name: 'Curl Predicador en Maquina',
    muscleGroupId: 'arms',
    equipment: 'machine',
    isCompound: false,
  },
  {
    id: 'machine_lat_pulldown',
    name: 'Jalon en Maquina',
    muscleGroupId: 'back',
    equipment: 'machine',
    isCompound: false,
  },
  {
    id: 't_bar_row',
    name: 'Remo en T',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'cable_upright_row',
    name: 'Remo al Menton en Polea',
    muscleGroupId: 'shoulders',
    equipment: 'cable',
    isCompound: true,
  },
  {
    id: 'incline_leg_press',
    name: 'Prensa Inclinada',
    muscleGroupId: 'legs',
    equipment: 'machine',
    isCompound: true,
  },
  {
    id: 'hack_squat',
    name: 'Hack Squat',
    muscleGroupId: 'legs',
    equipment: 'machine',
    isCompound: true,
  },
  {
    id: 'horizontal_leg_press',
    name: 'Prensa Horizontal',
    muscleGroupId: 'legs',
    equipment: 'machine',
    isCompound: true,
  },

  // ── PHUL exercises (unique to PHUL) ──
  {
    id: 'skullcrusher',
    name: 'Extensión de Tríceps Tumbado',
    muscleGroupId: 'arms',
    equipment: 'barbell',
    isCompound: false,
  },
  {
    id: 'incline_bench',
    name: 'Press Inclinado con Barra',
    muscleGroupId: 'chest',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'front_squat',
    name: 'Sentadilla Frontal',
    muscleGroupId: 'legs',
    equipment: 'barbell',
    isCompound: true,
  },
  // ── MUTENROSHI exercises ──

  // Block 1 — Core
  {
    id: 'plank',
    name: 'Plancha',
    muscleGroupId: 'core',
    equipment: 'bodyweight',
    isCompound: false,
  },
  {
    id: 'reverse_plank',
    name: 'Plancha Inversa',
    muscleGroupId: 'core',
    equipment: 'bodyweight',
    isCompound: false,
  },
  {
    id: 'sit_up_decline',
    name: 'Abdominal en Banco Declinado',
    muscleGroupId: 'core',
    equipment: 'bodyweight',
    isCompound: false,
  },

  // Block 2 — Squat/DL Activation
  {
    id: 'leg_curl_prone',
    name: 'Curl Femoral Tumbado',
    muscleGroupId: 'legs',
    equipment: 'machine',
    isCompound: false,
  },
  {
    id: 'hyperextension',
    name: 'Hiperextension',
    muscleGroupId: 'back',
    equipment: 'bodyweight',
    isCompound: false,
  },

  // Block 2 — Bench Activation
  {
    id: 'lateral_raise_band',
    name: 'Elevacion Lateral con Banda',
    muscleGroupId: 'shoulders',
    equipment: 'bands',
    isCompound: false,
  },
  {
    id: 'french_press_bench',
    name: 'Press Frances en Banco',
    muscleGroupId: 'arms',
    equipment: 'barbell',
    isCompound: false,
  },
  {
    id: 'rear_delt_band',
    name: 'Deltoides Posterior con Banda',
    muscleGroupId: 'shoulders',
    equipment: 'bands',
    isCompound: false,
  },

  // Block 3 — Squat Proprioception
  {
    id: 'bulgarian_split_squat_slow',
    name: 'Zancada Bulgara Lenta',
    muscleGroupId: 'legs',
    equipment: 'bodyweight',
    isCompound: true,
  },
  {
    id: 'calf_raise_proprioceptive',
    name: 'Elevacion de Gemelo Propioceptiva',
    muscleGroupId: 'calves',
    equipment: 'bodyweight',
    isCompound: false,
  },

  // Block 3 — Bench Proprioception
  {
    id: 'pulley_band_seated',
    name: 'Polea con Banda Sentado',
    muscleGroupId: 'back',
    equipment: 'bands',
    isCompound: true,
  },
  {
    id: 'pushup_isometric',
    name: 'Flexion Isometrica',
    muscleGroupId: 'chest',
    equipment: 'bodyweight',
    isCompound: true,
  },

  // Block 3 — DL Proprioception
  {
    id: 'deadlift_partial_blocks',
    name: 'Peso Muerto Parcial desde Bloques',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'leg_press_isometric',
    name: 'Prensa Isometrica',
    muscleGroupId: 'legs',
    equipment: 'machine',
    isCompound: true,
  },

  // Block 4 — Fundamentals (bodyweight phase)
  {
    id: 'squat_bodyweight',
    name: 'Sentadilla sin Peso',
    muscleGroupId: 'legs',
    equipment: 'bodyweight',
    isCompound: true,
  },
  {
    id: 'bench_pushups',
    name: 'Flexiones',
    muscleGroupId: 'chest',
    equipment: 'bodyweight',
    isCompound: true,
  },
  {
    id: 'deadlift_isometric',
    name: 'Peso Muerto Isometrico',
    muscleGroupId: 'back',
    equipment: 'bodyweight',
    isCompound: true,
  },

  // Block 4 — Fundamentals (loaded phase)
  {
    id: 'squat_barbell',
    name: 'Sentadilla con Barra',
    muscleGroupId: 'legs',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'bench_press_barbell',
    name: 'Press Banca con Barra',
    muscleGroupId: 'chest',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'deadlift_barbell',
    name: 'Peso Muerto con Barra',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },

  // ── Brunetti 365 exercises ──
  {
    id: 'bench_board',
    name: 'Press Banca con Tabla',
    muscleGroupId: 'chest',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'bench_pin',
    name: 'Press Banca con Pin',
    muscleGroupId: 'chest',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'one_arm_row',
    name: 'Remo Unilateral',
    muscleGroupId: 'back',
    equipment: 'dumbbell',
    isCompound: true,
  },
  {
    id: 'deadlift_elevated',
    name: 'Peso Muerto desde Elevacion',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'seal_row',
    name: 'Seal Row',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'leg_press_unilateral',
    name: 'Prensa Unilateral',
    muscleGroupId: 'legs',
    equipment: 'machine',
    isCompound: true,
  },
  {
    id: 'curl_elastico',
    name: 'Curl con Elastico',
    muscleGroupId: 'arms',
    equipment: 'bands',
    isCompound: false,
  },
  {
    id: 'french_press_band',
    name: 'Press Frances con Elastico',
    muscleGroupId: 'arms',
    equipment: 'bands',
    isCompound: false,
  },
  {
    id: 'lateral_raise_seated',
    name: 'Elevaciones Laterales Sentado',
    muscleGroupId: 'shoulders',
    equipment: 'dumbbell',
    isCompound: false,
  },
  {
    id: 'pin_squat',
    name: 'Sentadilla desde Pin',
    muscleGroupId: 'legs',
    equipment: 'barbell',
    isCompound: true,
  },

  // ── Sheiko exercises — Squat Variations ──
  {
    id: 'paused-squat-2s',
    name: 'Sentadilla con pausa 2s',
    muscleGroupId: 'legs',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'squat-pause-halfway-down',
    name: 'Sentadilla pausa a media bajada',
    muscleGroupId: 'legs',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'squat-pause-halfway-up',
    name: 'Sentadilla pausa a media subida',
    muscleGroupId: 'legs',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'squat-chains',
    name: 'Sentadilla con cadenas',
    muscleGroupId: 'legs',
    equipment: 'barbell',
    isCompound: true,
  },

  // ── Sheiko exercises — Bench Press Variations ──
  {
    id: 'paused-bench-2s',
    name: 'Press banca con pausa 2s',
    muscleGroupId: 'chest',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'paused-bench-3s',
    name: 'Press banca con pausa 3s',
    muscleGroupId: 'chest',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'bench-bands',
    name: 'Press banca con bandas',
    muscleGroupId: 'chest',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'bench-chains',
    name: 'Press banca con cadenas',
    muscleGroupId: 'chest',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'bench-slingshot',
    name: 'Press banca con slingshot',
    muscleGroupId: 'chest',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'board-press',
    name: 'Press en tabla',
    muscleGroupId: 'chest',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'decline-bench',
    name: 'Press banca declinado',
    muscleGroupId: 'chest',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'speed-bench',
    name: 'Press banca velocidad',
    muscleGroupId: 'chest',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'dumbbell-bench',
    name: 'Press banca con mancuernas',
    muscleGroupId: 'chest',
    equipment: 'dumbbell',
    isCompound: true,
  },
  {
    id: 'incline-shoulder-press',
    name: 'Press hombro inclinado sentado',
    muscleGroupId: 'shoulders',
    equipment: 'barbell',
    isCompound: true,
  },

  // ── Sheiko exercises — Deadlift Variations ──
  {
    id: 'deadlift-bands',
    name: 'Peso muerto con bandas',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'deadlift-chains',
    name: 'Peso muerto con cadenas',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'deadlift-blocks',
    name: 'Peso muerto desde bloques',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'deadlift-blocks-chains',
    name: 'Peso muerto bloques + cadenas',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'deficit-deadlift',
    name: 'Peso muerto deficit',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'deadlift-pause-knees',
    name: 'Peso muerto pausa rodillas',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'deadlift-knees-full',
    name: 'Peso muerto rodillas + completo',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'deadlift-plus-below-knees',
    name: 'Peso muerto + desde debajo rodillas',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'deadlift-above-knees-blocks',
    name: 'Peso muerto encima rodillas bloques',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'deadlift-pause-below-above',
    name: 'Peso muerto pausa debajo y encima',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'deadlift-snatch-grip',
    name: 'Peso muerto agarre arrancada',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },

  // ── Sheiko exercises — GPP / Accessories ──
  {
    id: 'pecs',
    name: 'Pectorales',
    muscleGroupId: 'chest',
    equipment: null,
    isCompound: false,
  },
  {
    id: 'front-delts',
    name: 'Deltoides frontales',
    muscleGroupId: 'shoulders',
    equipment: null,
    isCompound: false,
  },
  {
    id: 'medial-delts',
    name: 'Deltoides laterales',
    muscleGroupId: 'shoulders',
    equipment: null,
    isCompound: false,
  },
  {
    id: 'triceps-pushdowns',
    name: 'Extension triceps polea',
    muscleGroupId: 'arms',
    equipment: 'cable',
    isCompound: false,
  },
  {
    id: 'triceps-standing',
    name: 'Triceps de pie',
    muscleGroupId: 'arms',
    equipment: null,
    isCompound: false,
  },
  {
    id: 'lats',
    name: 'Dorsales',
    muscleGroupId: 'back',
    equipment: null,
    isCompound: false,
  },
  {
    id: 'abs',
    name: 'Abdominales',
    muscleGroupId: 'core',
    equipment: null,
    isCompound: false,
  },
  {
    id: 'hyperextensions',
    name: 'Hiperextensiones',
    muscleGroupId: 'back',
    equipment: 'bodyweight',
    isCompound: false,
  },
  {
    id: 'reverse-hyperextensions',
    name: 'Hiperextensiones inversas',
    muscleGroupId: 'back',
    equipment: 'bodyweight',
    isCompound: false,
  },
  {
    id: 'leg-curls',
    name: 'Curl femoral',
    muscleGroupId: 'legs',
    equipment: 'machine',
    isCompound: false,
  },
  {
    id: 'leg-extensions',
    name: 'Extension cuadriceps',
    muscleGroupId: 'legs',
    equipment: 'machine',
    isCompound: false,
  },
  {
    id: 'leg-press',
    name: 'Prensa de piernas',
    muscleGroupId: 'legs',
    equipment: 'machine',
    isCompound: true,
  },
  {
    id: 'goodmorning',
    name: 'Buenos dias',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'goodmorning-seated',
    name: 'Buenos dias sentado',
    muscleGroupId: 'back',
    equipment: 'barbell',
    isCompound: true,
  },
  // ── Sheiko exercises — Additional GPP (7.4 / 7.5) ──
  {
    id: 'dips',
    name: 'Fondos en paralelas',
    muscleGroupId: 'chest',
    equipment: 'bodyweight',
    isCompound: true,
  },
  {
    id: 'seated-rowing',
    name: 'Remo sentado',
    muscleGroupId: 'back',
    equipment: 'cable',
    isCompound: true,
  },
  {
    id: 'bench-close-grip',
    name: 'Press Banca agarre cerrado',
    muscleGroupId: 'chest',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'bench-middle-grip',
    name: 'Press Banca agarre medio',
    muscleGroupId: 'chest',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'front-squat',
    name: 'Sentadilla frontal',
    muscleGroupId: 'legs',
    equipment: 'barbell',
    isCompound: true,
  },
  {
    id: 'rear-delts',
    name: 'Deltoides posteriores',
    muscleGroupId: 'shoulders',
    equipment: null,
    isCompound: false,
  },
  {
    id: 'biceps',
    name: 'Biceps',
    muscleGroupId: 'arms',
    equipment: null,
    isCompound: false,
  },
  {
    id: 'french-press',
    name: 'Press Frances',
    muscleGroupId: 'arms',
    equipment: 'barbell',
    isCompound: false,
  },
] as const;

export async function seedExercises(db: DbClient): Promise<void> {
  await db
    .insert(exercises)
    .values(
      CANONICAL_EXERCISES.map((ex) => ({
        id: ex.id,
        name: ex.name,
        muscleGroupId: ex.muscleGroupId,
        equipment: ex.equipment,
        isCompound: ex.isCompound,
        isPreset: true,
        createdBy: null,
      }))
    )
    .onConflictDoNothing();
}
