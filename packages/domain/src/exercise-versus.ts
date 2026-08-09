import { getVersusProfile } from './exercise-versus-profiles';
import type {
  VersusAxis,
  VersusCompareResult,
  VersusConfidence,
  VersusEvidenceGrade,
  VersusGoal,
  VersusOutcome,
  VersusPoint,
  VersusResult,
  VersusScores,
} from './schemas/exercise-versus';
import { VersusGoalSchema, VersusRequestSchema } from './schemas/exercise-versus';

const LOWER_IS_BETTER: ReadonlySet<VersusAxis> = new Set([
  'stabilityDemand',
  'skillDemand',
  'shoulderStress',
]);

const REFERENT_AXES: Readonly<Partial<Record<VersusAxis, string>>> = {
  strengthTransferFlatBench: 'bench',
};

const PRO_DELTA_THRESHOLD = 1.5;
const TIE_MARGIN = 0.35;

type GoalWeights = Readonly<Partial<Record<VersusAxis, number>>>;

/**
 * Goal → axis weights. Negative weight ⇒ lower raw score is better.
 *
 * MA-informed design:
 * - Hypertrophy: regional target + ROM/lengthened loading (Schoenfeld ROM SR; Varovic 2025);
 *   overload down-weighted (hypertrophy load-tolerant — Schoenfeld 2017 load MA).
 * - Max strength on flat bench: specificity (TF) + heavy overload (Haugen free-weight strength
 *   tests; Schoenfeld load MA); free-path skill/stability small positive.
 * - Shoulder / beginner: safety and accessibility first.
 */
const GOAL_WEIGHTS: Readonly<Record<VersusGoal, GoalWeights>> = {
  hypertrophy_upper_chest: {
    upperChest: 3.4,
    midChest: 0.9,
    overloadPotential: 1.1,
    romStretch: 1.6,
    unilateralBalance: 0.5,
    shoulderStress: -0.5,
  },
  hypertrophy_mid_chest: {
    midChest: 3.2,
    upperChest: 0.7,
    lowerChest: 0.5,
    overloadPotential: 1.2,
    romStretch: 1.8,
    unilateralBalance: 0.4,
  },
  hypertrophy_lower_chest: {
    lowerChest: 3.4,
    midChest: 1.0,
    overloadPotential: 1.1,
    romStretch: 1.3,
    upperChest: 0.2,
  },
  general_chest_hypertrophy: {
    midChest: 2.0,
    upperChest: 1.5,
    lowerChest: 1.0,
    overloadPotential: 1.3,
    romStretch: 2.0,
    unilateralBalance: 0.5,
  },
  max_strength_bench: {
    strengthTransferFlatBench: 3.6,
    overloadPotential: 2.4,
    midChest: 0.7,
    skillDemand: 0.45,
    stabilityDemand: 0.35,
  },
  shoulder_friendly: {
    shoulderStress: -3.2,
    stabilityDemand: -0.7,
    beginnerAccessibility: 1.2,
    overloadPotential: 0.7,
    romStretch: 0.4,
  },
  beginner_friendly: {
    beginnerAccessibility: 3.2,
    skillDemand: -2.0,
    stabilityDemand: -1.6,
    shoulderStress: -1.0,
    overloadPotential: 0.7,
  },
};

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

function weightedScore(scores: VersusScores, weights: GoalWeights): number {
  let total = 0;
  for (const [axis, weight] of Object.entries(weights) as [VersusAxis, number][]) {
    if (weight === 0) continue;
    total += weight * scores[axis];
  }
  return clampScore(total);
}

function axisAdvantageForGoal(
  axis: VersusAxis,
  scoreA: number,
  scoreB: number,
  weight: number | undefined
): number {
  if (weight !== undefined && weight !== 0) {
    return weight > 0 ? scoreA - scoreB : scoreB - scoreA;
  }
  if (LOWER_IS_BETTER.has(axis)) return scoreB - scoreA;
  return scoreA - scoreB;
}

function isReferentTautology(axis: VersusAxis, exerciseIdA: string, exerciseIdB: string): boolean {
  const referent = REFERENT_AXES[axis];
  if (referent === undefined) return false;
  return exerciseIdA === referent || exerciseIdB === referent;
}

function buildPros(
  scoresA: VersusScores,
  scoresB: VersusScores,
  goal: VersusGoal,
  exerciseIdA: string,
  exerciseIdB: string
): { readonly prosA: VersusPoint[]; readonly prosB: VersusPoint[] } {
  const weights = GOAL_WEIGHTS[goal];
  const prosA: VersusPoint[] = [];
  const prosB: VersusPoint[] = [];

  for (const [axis, weight] of Object.entries(weights) as [VersusAxis, number][]) {
    if (weight === 0) continue;
    if (isReferentTautology(axis, exerciseIdA, exerciseIdB)) continue;

    const adv = axisAdvantageForGoal(axis, scoresA[axis], scoresB[axis], weight);
    const delta = Math.abs(adv);
    if (delta < PRO_DELTA_THRESHOLD) continue;

    const point: VersusPoint = {
      side: adv > 0 ? 'a' : 'b',
      axis,
      delta: clampScore(delta),
    };
    if (point.side === 'a') prosA.push(point);
    else prosB.push(point);
  }

  const byImportance = (x: VersusPoint, y: VersusPoint): number => {
    const wX = Math.abs(weights[x.axis] ?? 0);
    const wY = Math.abs(weights[y.axis] ?? 0);
    if (wY !== wX) return wY - wX;
    return y.delta - x.delta;
  };
  prosA.sort(byImportance);
  prosB.sort(byImportance);
  return { prosA, prosB };
}

function gradeRank(grade: VersusEvidenceGrade): number {
  switch (grade) {
    case 'meta_analysis':
      return 4;
    case 'systematic_review':
      return 3;
    case 'consistent_primary':
      return 2;
    case 'mechanistic':
      return 1;
  }
}

function resolveConfidence(
  margin: number,
  bestGrade: VersusEvidenceGrade,
  decisiveAxesCovered: boolean
): VersusConfidence {
  if (margin < TIE_MARGIN) return 'low';
  const g = gradeRank(bestGrade);
  if (g >= 4 && margin >= 1.2 && decisiveAxesCovered) return 'high';
  if (g >= 3 && margin >= 0.7) return 'medium';
  if (g >= 2 && margin >= 1.0) return 'medium';
  return 'low';
}

function bestEvidenceGrade(grades: readonly VersusEvidenceGrade[]): VersusEvidenceGrade {
  let best: VersusEvidenceGrade = 'mechanistic';
  for (const g of grades) {
    if (gradeRank(g) > gradeRank(best)) best = g;
  }
  return best;
}

function decisiveAxesForGoal(goal: VersusGoal): readonly VersusAxis[] {
  const weights = GOAL_WEIGHTS[goal];
  return (Object.entries(weights) as [VersusAxis, number][])
    .filter(([, w]) => Math.abs(w) >= 1.5)
    .map(([axis]) => axis);
}

export function weightedAxesForGoal(goal: VersusGoal): readonly VersusAxis[] {
  const weights = GOAL_WEIGHTS[goal];
  return (Object.entries(weights) as [VersusAxis, number][])
    .filter(([, w]) => w !== 0)
    .sort((a, b) => {
      const d = Math.abs(b[1]) - Math.abs(a[1]);
      if (d !== 0) return d;
      return a[0].localeCompare(b[0]);
    })
    .map(([axis]) => axis);
}

export function compareExercises(
  exerciseIdA: string,
  exerciseIdB: string,
  goal: VersusGoal
): VersusCompareResult {
  const parsed = VersusRequestSchema.safeParse({ exerciseIdA, exerciseIdB, goal });
  if (!parsed.success) {
    return { ok: false, code: 'invalid_request' };
  }

  if (exerciseIdA === exerciseIdB) {
    return { ok: false, code: 'same_exercise' };
  }

  const profileA = getVersusProfile(exerciseIdA);
  const profileB = getVersusProfile(exerciseIdB);
  const missing: string[] = [];
  if (profileA === undefined) missing.push(exerciseIdA);
  if (profileB === undefined) missing.push(exerciseIdB);
  if (profileA === undefined || profileB === undefined) {
    return { ok: false, code: 'profile_missing', missingIds: missing };
  }

  if (profileA.muscleGroupId !== profileB.muscleGroupId) {
    return { ok: false, code: 'muscle_group_mismatch' };
  }

  const weights = GOAL_WEIGHTS[goal];
  const scoreA = weightedScore(profileA.scores, weights);
  const scoreB = weightedScore(profileB.scores, weights);
  const margin = clampScore(Math.abs(scoreA - scoreB));

  let outcome: VersusOutcome = 'tie';
  if (margin >= TIE_MARGIN) {
    outcome = scoreA > scoreB ? 'a' : 'b';
  }

  const { prosA, prosB } = buildPros(
    profileA.scores,
    profileB.scores,
    goal,
    profileA.exerciseId,
    profileB.exerciseId
  );

  const evidenceRows = [
    ...profileA.evidence.map((row) => ({
      grade: row.grade,
      axes: [...row.axes],
      reference: row.reference,
      sourceExerciseId: profileA.exerciseId,
    })),
    ...profileB.evidence.map((row) => ({
      grade: row.grade,
      axes: [...row.axes],
      reference: row.reference,
      sourceExerciseId: profileB.exerciseId,
    })),
  ];

  const seen = new Set<string>();
  const dedupedEvidence = evidenceRows.filter((row) => {
    const key = row.reference.doi ?? row.reference.pmid ?? row.reference.title;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const decisive = decisiveAxesForGoal(goal);
  const decisiveSet = new Set(decisive);
  const decisiveGrades = dedupedEvidence
    .filter((e) => e.axes.some((axis) => decisiveSet.has(axis)))
    .map((e) => e.grade);
  const bestGrade =
    decisiveGrades.length > 0
      ? bestEvidenceGrade(decisiveGrades)
      : bestEvidenceGrade(dedupedEvidence.map((e) => e.grade));

  const coveredAxes = new Set(dedupedEvidence.flatMap((e) => e.axes));
  const decisiveAxesCovered =
    decisive.length === 0 || decisive.every((axis) => coveredAxes.has(axis));

  const result: VersusResult = {
    exerciseA: {
      exerciseId: profileA.exerciseId,
      name: profileA.name,
      score: scoreA,
    },
    exerciseB: {
      exerciseId: profileB.exerciseId,
      name: profileB.name,
      score: scoreB,
    },
    goal,
    outcome,
    winnerId: outcome === 'a' ? profileA.exerciseId : outcome === 'b' ? profileB.exerciseId : null,
    confidence: resolveConfidence(margin, bestGrade, decisiveAxesCovered),
    scoreMargin: margin,
    prosA,
    prosB,
    sharedCaveats: ['same_muscle_group_only', 'goal_relative_winner', 'not_medical_advice'],
    evidence: dedupedEvidence,
  };

  return { ok: true, result };
}

export function isVersusGoal(value: string): value is VersusGoal {
  return VersusGoalSchema.safeParse(value).success;
}

export { GOAL_WEIGHTS, LOWER_IS_BETTER, PRO_DELTA_THRESHOLD, REFERENT_AXES, TIE_MARGIN };
