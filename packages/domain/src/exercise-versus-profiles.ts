import type { ExerciseVersusProfile, VersusReference } from './schemas/exercise-versus';
import { ExerciseVersusProfileSchema } from './schemas/exercise-versus';

/**
 * Curated references for the versus engine.
 * DOIs/PMIDs verified against PubMed. Grades must match what the paper actually supports
 * (do not attach free-weight transfer claims to load-only metas, etc.).
 */
const REF = {
  /** EMG: bench angle shifts clavicular vs sternal pec emphasis. */
  lauver2016: {
    doi: '10.1080/17461391.2015.1022605',
    pmid: '25799093',
    title:
      'Influence of bench angle on upper extremity muscular activation during bench press exercise',
    authors: 'Lauver JD, Cayot TE, Scheuermann BW',
    year: 2016,
    url: 'https://doi.org/10.1080/17461391.2015.1022605',
  },
  /** EMG across five inclinations — multi-angle regional activation. */
  rodriguez2020: {
    doi: '10.3390/ijerph17197339',
    pmid: '33049982',
    title:
      'Effect of Five Bench Inclinations on the Electromyographic Activity of the Pectoralis Major, Anterior Deltoid, and Triceps Brachii during the Bench Press Exercise',
    authors: 'Rodríguez-Ridao D, Antequera-Vique JA, Martín-Fuentes I, Muyor JM',
    year: 2020,
    url: 'https://doi.org/10.3390/ijerph17197339',
  },
  /** Free vs DB / variation performance in athletes. */
  saeterbakken2017: {
    doi: '10.1515/hukin-2017-0047',
    pmid: '28713459',
    title:
      'The Effects of Bench Press Variations in Competitive Athletes on Muscle Activity and Performance',
    authors: 'Saeterbakken AH, Mo DA, Scott S, Andersen V',
    year: 2017,
    url: 'https://doi.org/10.1515/hukin-2017-0047',
  },
  /**
   * Load continuum MA: high load superior for maximal strength; hypertrophy more load-tolerant
   * when sets are taken near failure. Not an exercise-selection or implement meta.
   */
  schoenfeld2017loads: {
    doi: '10.1519/JSC.0000000000002200',
    pmid: '28834797',
    title:
      'Strength and Hypertrophy Adaptations Between Low- vs. High-Load Resistance Training: A Systematic Review and Meta-analysis',
    authors: 'Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW',
    year: 2017,
    url: 'https://doi.org/10.1519/JSC.0000000000002200',
  },
  /** Full/long ROM tends to favor hypertrophy vs partial short-ROM when equated carefully. */
  schoenfeld2020rom: {
    doi: '10.1177/2050312120901559',
    pmid: '32030125',
    title:
      'Effects of range of motion on muscle development during resistance training interventions: A systematic review',
    authors: 'Schoenfeld BJ, Grgic J',
    year: 2020,
    url: 'https://doi.org/10.1177/2050312120901559',
  },
  /**
   * Muscle length / regional hypertrophy MA: training at longer lengths often favors growth
   * in the lengthened region — supports stretch/ROM scoring for hypertrophy goals.
   */
  varovic2025length: {
    doi: '10.1055/a-2615-4935',
    pmid: '40570881',
    title:
      'Does Muscle Length Influence Regional Hypertrophy? A Systematic Review and Meta-Analysis',
    authors: 'Varovic D, Wolf M, Schoenfeld BJ, Steele J, Grgic J, Mikulic P',
    year: 2025,
    url: 'https://doi.org/10.1055/a-2615-4935',
  },
  /**
   * Free-weight vs machine MA: similar hypertrophy; free-weights advantage on free-weight
   * strength tests (specificity). Primary source for TF and machine hypertrophy parity.
   */
  haugen2023freeMachine: {
    doi: '10.1186/s13102-023-00713-4',
    pmid: '37582807',
    title:
      'Effect of free-weight vs. machine-based strength training on maximal strength, hypertrophy and jump performance - a systematic review and meta-analysis',
    authors: 'Haugen ME, Vårvik FT, Larsen S, Haugen AS, van den Tillaar R, Bjørnsen T',
    year: 2023,
    url: 'https://doi.org/10.1186/s13102-023-00713-4',
  },
  /** Convergent free vs machine MA (size/strength/power). */
  heidel2022freeMachine: {
    doi: '10.23736/S0022-4707.21.12929-9',
    pmid: '34609100',
    title:
      'Machines and free weight exercises: a systematic review and meta-analysis comparing changes in muscle size, strength, and power',
    authors: 'Heidel KA, Novak ZJ, Dankel SJ',
    year: 2022,
    url: 'https://doi.org/10.23736/S0022-4707.21.12929-9',
  },
  /** Smith vs free bench EMG — stabilizer demand analogy for fixed-path presses (not selectorized). */
  schick2010: {
    doi: '10.1519/JSC.0b013e3181cc2237',
    pmid: '20093960',
    title: 'A comparison of muscle activation between a Smith machine and free weight bench press',
    authors: 'Schick EE, Coburn JW, Brown LE, Judelson DA, Khamoui AV, Tran TT, Uribe BP',
    year: 2010,
    url: 'https://doi.org/10.1519/JSC.0b013e3181cc2237',
  },
  /** Modeling: technique variations change shoulder joint loads. */
  noteboom2024: {
    doi: '10.3389/fphys.2024.1393235',
    pmid: '38974522',
    title:
      'Effects of bench press technique variations on musculoskeletal shoulder loads and potential injury risk',
    authors: 'Noteboom L, Belli I, Hoozemans MJM, Seth A, Veeger HEJ, Van Der Helm FCT',
    year: 2024,
    url: 'https://doi.org/10.3389/fphys.2024.1393235',
  },
} as const satisfies Record<string, VersusReference>;

/**
 * Curated chest profiles for the deterministic exercise-versus engine.
 *
 * Scoring principles (evidence-constrained):
 * 1. Regional chest axes track multi-study EMG angle effects (Lauver, Rodríguez) — EMG ≠ hypertrophy,
 *    so extremes are moderated vs pure EMG rank order.
 * 2. Hypertrophy goals lean on ROM/lengthened loading (Schoenfeld ROM SR; Varovic length MA) and
 *    treat free vs machine hypertrophy as near-parity (Haugen, Heidel MAs).
 * 3. Max-strength-on-flat-bench leans on specificity + heavy loading capacity (Schoenfeld load MA;
 *    Haugen free-weight strength on free tests) — transfer is about the test lift, not “better muscle”.
 * 4. Machines score high beginner/low skill-stability (fixed path) but lower free-bench transfer.
 * 5. Fail closed: only exercises present here can be compared.
 */
const CHEST_PROFILES: readonly ExerciseVersusProfile[] = [
  {
    exerciseId: 'bench',
    muscleGroupId: 'chest',
    name: { es: 'Press banca con barra', en: 'Barbell bench press' },
    equipment: 'barbell',
    isCompound: true,
    scores: {
      upperChest: 5,
      midChest: 8,
      lowerChest: 6,
      overloadPotential: 10,
      stabilityDemand: 7,
      skillDemand: 7,
      shoulderStress: 7,
      romStretch: 6,
      unilateralBalance: 2,
      beginnerAccessibility: 5,
      strengthTransferFlatBench: 10,
    },
    evidence: [
      {
        grade: 'consistent_primary',
        axes: ['upperChest', 'midChest', 'lowerChest'],
        reference: REF.rodriguez2020,
        note: {
          es: 'Ángulo 0° prioriza porción esternal vs inclinaciones altas (EMG).',
          en: '0° angle prioritizes sternal pec vs steeper inclines (EMG).',
        },
      },
      {
        grade: 'meta_analysis',
        axes: ['overloadPotential'],
        reference: REF.schoenfeld2017loads,
        note: {
          es: 'Cargas altas favorecen 1RM; la hipertrofia tolera mejor un rango amplio de cargas cerca del fallo.',
          en: 'Heavy loads favor 1RM strength; hypertrophy is more load-tolerant near failure.',
        },
      },
      {
        grade: 'meta_analysis',
        axes: ['strengthTransferFlatBench'],
        reference: REF.haugen2023freeMachine,
        note: {
          es: 'La fuerza en tests de peso libre favorece el entrenamiento específico con peso libre.',
          en: 'Free-weight strength tests favor free-weight-specific practice.',
        },
      },
      {
        grade: 'mechanistic',
        axes: ['shoulderStress'],
        reference: REF.noteboom2024,
      },
    ],
  },
  {
    exerciseId: 'incline_bench',
    muscleGroupId: 'chest',
    name: { es: 'Press inclinado con barra', en: 'Barbell incline bench press' },
    equipment: 'barbell',
    isCompound: true,
    scores: {
      // Clavicular EMG rises ~30–45°; moderated from pure EMG peak because hypertrophy transfer is imperfect.
      upperChest: 9,
      midChest: 6,
      lowerChest: 3,
      overloadPotential: 8,
      stabilityDemand: 7,
      skillDemand: 7,
      shoulderStress: 8,
      romStretch: 5,
      unilateralBalance: 2,
      beginnerAccessibility: 4,
      strengthTransferFlatBench: 7,
    },
    evidence: [
      {
        grade: 'consistent_primary',
        axes: ['upperChest', 'midChest', 'shoulderStress'],
        reference: REF.lauver2016,
        note: {
          es: 'Inclinación ~30–45° eleva porción clavicular y deltoides anterior (EMG).',
          en: '~30–45° incline raises clavicular pec and anterior deltoid demand (EMG).',
        },
      },
      {
        grade: 'consistent_primary',
        axes: ['upperChest', 'midChest', 'lowerChest'],
        reference: REF.rodriguez2020,
      },
      {
        grade: 'meta_analysis',
        axes: ['strengthTransferFlatBench', 'overloadPotential'],
        reference: REF.haugen2023freeMachine,
        note: {
          es: 'Variante libre cercana a banca: buena sobrecarga; transferencia a plana parcial por especificidad del ángulo.',
          en: 'Free-weight cousin of flat bench: strong overload; partial flat transfer via angle specificity.',
        },
      },
    ],
  },
  {
    exerciseId: 'decline-bench',
    muscleGroupId: 'chest',
    name: { es: 'Press declinado con barra', en: 'Barbell decline bench press' },
    equipment: 'barbell',
    isCompound: true,
    scores: {
      upperChest: 3,
      midChest: 7,
      lowerChest: 9,
      overloadPotential: 8,
      stabilityDemand: 6,
      skillDemand: 7,
      shoulderStress: 5,
      romStretch: 5,
      unilateralBalance: 2,
      // Decline rack/spotter setup is less beginner-friendly than flat.
      beginnerAccessibility: 2,
      strengthTransferFlatBench: 6,
    },
    evidence: [
      {
        grade: 'consistent_primary',
        axes: ['lowerChest', 'upperChest', 'midChest', 'shoulderStress'],
        reference: REF.lauver2016,
        note: {
          es: 'Declinación reduce énfasis clavicular y suele bajar estrés anterior de hombro vs inclinado.',
          en: 'Decline reduces clavicular emphasis and often lowers anterior shoulder stress vs incline.',
        },
      },
      {
        grade: 'consistent_primary',
        axes: ['lowerChest', 'midChest', 'upperChest'],
        reference: REF.rodriguez2020,
      },
    ],
  },
  {
    exerciseId: 'dumbbell-bench',
    muscleGroupId: 'chest',
    name: { es: 'Press banca con mancuernas', en: 'Dumbbell bench press' },
    equipment: 'dumbbell',
    isCompound: true,
    scores: {
      upperChest: 5,
      midChest: 8,
      lowerChest: 6,
      // Absolute load usually below BB; still progressive.
      overloadPotential: 7,
      stabilityDemand: 8,
      skillDemand: 6,
      // Often more natural glenohumeral path than fixed BB bar path.
      shoulderStress: 5,
      // Deep stretch at bottom — lengthened-position bias (ROM SR + length MA).
      romStretch: 9,
      unilateralBalance: 9,
      beginnerAccessibility: 6,
      strengthTransferFlatBench: 7,
    },
    evidence: [
      {
        grade: 'systematic_review',
        axes: ['romStretch'],
        reference: REF.schoenfeld2020rom,
        note: {
          es: 'Mayor ROM / trabajo en longitudes largas favorece hipertrofia cuando se tolera.',
          en: 'Greater ROM / long-muscle-length work favors hypertrophy when tolerated.',
        },
      },
      {
        grade: 'meta_analysis',
        axes: ['romStretch', 'midChest'],
        reference: REF.varovic2025length,
        note: {
          es: 'El entrenamiento en longitudes musculares largas puede sesgar la hipertrofia regional.',
          en: 'Training at longer muscle lengths can bias regional hypertrophy.',
        },
      },
      {
        grade: 'consistent_primary',
        axes: ['unilateralBalance', 'romStretch', 'shoulderStress', 'overloadPotential'],
        reference: REF.saeterbakken2017,
      },
      {
        grade: 'meta_analysis',
        axes: ['strengthTransferFlatBench'],
        reference: REF.haugen2023freeMachine,
      },
    ],
  },
  {
    exerciseId: 'incline_db_press',
    muscleGroupId: 'chest',
    name: { es: 'Press inclinado con mancuernas', en: 'Incline dumbbell press' },
    equipment: 'dumbbell',
    isCompound: true,
    scores: {
      upperChest: 9,
      midChest: 6,
      lowerChest: 3,
      overloadPotential: 6,
      stabilityDemand: 8,
      skillDemand: 6,
      shoulderStress: 7,
      romStretch: 9,
      unilateralBalance: 9,
      beginnerAccessibility: 5,
      strengthTransferFlatBench: 5,
    },
    evidence: [
      {
        grade: 'consistent_primary',
        axes: ['upperChest', 'midChest', 'shoulderStress'],
        reference: REF.lauver2016,
      },
      {
        grade: 'systematic_review',
        axes: ['romStretch'],
        reference: REF.schoenfeld2020rom,
      },
      {
        grade: 'meta_analysis',
        axes: ['romStretch', 'upperChest'],
        reference: REF.varovic2025length,
        note: {
          es: 'Inclinado + estiramiento profundo combina sesgo clavicular (EMG) y longitud larga (MA).',
          en: 'Incline + deep stretch combines clavicular bias (EMG) and long-length loading (MA).',
        },
      },
    ],
  },
  {
    exerciseId: 'bench_machine',
    muscleGroupId: 'chest',
    name: { es: 'Press banca en máquina', en: 'Machine chest press' },
    equipment: 'machine',
    isCompound: true,
    scores: {
      // Hypertrophy parity with free weights when effort is high (Haugen/Heidel).
      upperChest: 5,
      midChest: 8,
      lowerChest: 6,
      overloadPotential: 8,
      stabilityDemand: 2,
      skillDemand: 2,
      shoulderStress: 4,
      romStretch: 5,
      unilateralBalance: 3,
      beginnerAccessibility: 9,
      // Free-bench 1RM transfer lags free-weight practice (specificity).
      strengthTransferFlatBench: 4,
    },
    evidence: [
      {
        grade: 'meta_analysis',
        axes: ['midChest', 'upperChest', 'lowerChest', 'overloadPotential'],
        reference: REF.haugen2023freeMachine,
        note: {
          es: 'Hipertrofia similar libre vs máquina; la ventaja de libres aparece sobre todo en tests de fuerza libre.',
          en: 'Similar hypertrophy free vs machine; free-weight edge mainly on free strength tests.',
        },
      },
      {
        grade: 'meta_analysis',
        axes: ['strengthTransferFlatBench', 'overloadPotential'],
        reference: REF.heidel2022freeMachine,
      },
      {
        grade: 'mechanistic',
        axes: ['beginnerAccessibility', 'stabilityDemand', 'skillDemand'],
        reference: REF.schick2010,
        note: {
          es: 'Trayectoria fija (Smith como análogo) reduce demanda estabilizadora vs barra libre.',
          en: 'Fixed path (Smith as analogue) lowers stabilizer demand vs free bench.',
        },
      },
    ],
  },
  {
    exerciseId: 'pec_deck',
    muscleGroupId: 'chest',
    name: { es: 'Pec deck / contractora', en: 'Pec deck / chest fly machine' },
    equipment: 'machine',
    isCompound: false,
    scores: {
      upperChest: 4,
      // Isolation can drive local hypertrophy; not a press substitute for overload/TF.
      midChest: 8,
      lowerChest: 5,
      overloadPotential: 4,
      stabilityDemand: 1,
      skillDemand: 1,
      shoulderStress: 6,
      romStretch: 8,
      unilateralBalance: 2,
      beginnerAccessibility: 8,
      strengthTransferFlatBench: 2,
    },
    evidence: [
      {
        grade: 'systematic_review',
        axes: ['romStretch'],
        reference: REF.schoenfeld2020rom,
        note: {
          es: 'Aislamientos en ROM largo aportan volumen local; no sustituyen la sobrecarga de un press.',
          en: 'Long-ROM isolation adds local volume; does not replace press overload.',
        },
      },
      {
        grade: 'meta_analysis',
        axes: ['romStretch', 'midChest'],
        reference: REF.varovic2025length,
      },
      {
        grade: 'meta_analysis',
        axes: ['strengthTransferFlatBench'],
        reference: REF.haugen2023freeMachine,
        note: {
          es: 'Baja especificidad hacia 1RM de banca libre frente a presses compuestos.',
          en: 'Low specificity to free-bench 1RM vs compound presses.',
        },
      },
    ],
  },
  {
    exerciseId: 'incline_machine_press',
    muscleGroupId: 'chest',
    name: { es: 'Press inclinado en máquina', en: 'Incline machine press' },
    equipment: 'machine',
    isCompound: true,
    scores: {
      // Angle still biases upper; machine path slightly softens free-incline peak.
      upperChest: 8,
      midChest: 6,
      lowerChest: 3,
      overloadPotential: 7,
      stabilityDemand: 2,
      skillDemand: 2,
      shoulderStress: 6,
      romStretch: 5,
      unilateralBalance: 3,
      beginnerAccessibility: 9,
      strengthTransferFlatBench: 4,
    },
    evidence: [
      {
        grade: 'consistent_primary',
        axes: ['upperChest', 'midChest', 'lowerChest'],
        reference: REF.rodriguez2020,
        note: {
          es: 'El sesgo por ángulo de banco se extrapolá con cautela a trayectorias de máquina.',
          en: 'Bench-angle bias is extrapolated cautiously to machine paths.',
        },
      },
      {
        grade: 'meta_analysis',
        axes: ['upperChest', 'overloadPotential', 'strengthTransferFlatBench'],
        reference: REF.haugen2023freeMachine,
      },
      {
        grade: 'mechanistic',
        axes: ['beginnerAccessibility', 'stabilityDemand', 'skillDemand'],
        reference: REF.schick2010,
      },
    ],
  },
];

function assertProfiles(
  profiles: readonly ExerciseVersusProfile[]
): readonly ExerciseVersusProfile[] {
  const seen = new Set<string>();
  for (const profile of profiles) {
    const parsed = ExerciseVersusProfileSchema.safeParse(profile);
    if (!parsed.success) {
      throw new Error(`Invalid versus profile ${profile.exerciseId}: ${parsed.error.message}`);
    }
    if (seen.has(profile.exerciseId)) {
      throw new Error(`Duplicate versus profile id: ${profile.exerciseId}`);
    }
    seen.add(profile.exerciseId);
  }
  return profiles;
}

export const EXERCISE_VERSUS_PROFILES: readonly ExerciseVersusProfile[] =
  assertProfiles(CHEST_PROFILES);

const PROFILE_BY_ID: ReadonlyMap<string, ExerciseVersusProfile> = new Map(
  EXERCISE_VERSUS_PROFILES.map((p) => [p.exerciseId, p])
);

export function getVersusProfile(exerciseId: string): ExerciseVersusProfile | undefined {
  return PROFILE_BY_ID.get(exerciseId);
}

export function listVersusProfiles(muscleGroupId?: string): readonly ExerciseVersusProfile[] {
  if (muscleGroupId === undefined) return EXERCISE_VERSUS_PROFILES;
  return EXERCISE_VERSUS_PROFILES.filter((p) => p.muscleGroupId === muscleGroupId);
}

export function listComparableExerciseIds(muscleGroupId?: string): readonly string[] {
  return listVersusProfiles(muscleGroupId).map((p) => p.exerciseId);
}
