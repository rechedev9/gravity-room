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
