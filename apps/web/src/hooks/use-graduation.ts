import { useMemo } from 'react';
import {
  computeGraduationTargets,
  type GraduationState,
  type GraduationTarget,
} from '@gzclp/shared/graduation';
import { isRecord } from '@gzclp/shared/type-guards';

interface UseGraduationOptions {
  readonly definition: { readonly displayMode?: string } | undefined;
  readonly config: Record<string, number | string> | null;
  readonly metadata: unknown;
  readonly updateMetadata: (metadata: Record<string, unknown>) => void;
  readonly onBackToDashboard?: () => void;
}

interface UseGraduationReturn {
  readonly isMutenroshi: boolean;
  readonly graduationState: GraduationState;
  readonly graduationTargets: readonly GraduationTarget[];
  readonly handleGraduationStartJaw: (estimatedTMs: Record<string, number>) => void;
  readonly handleGraduationDismiss: () => void;
}

const DEFAULT_STATE: GraduationState = {
  squat: false,
  bench: false,
  deadlift: false,
  allPassed: false,
};

export function useGraduation({
  definition,
  config,
  metadata,
  updateMetadata,
  onBackToDashboard,
}: UseGraduationOptions): UseGraduationReturn {
  const isMutenroshi = definition?.displayMode === 'blocks';

  const graduationState = useMemo((): GraduationState => {
    if (!isRecord(metadata)) return DEFAULT_STATE;
    const grad = metadata.graduation;
    if (!isRecord(grad)) return DEFAULT_STATE;
    return {
      squat: grad.squat === true,
      bench: grad.bench === true,
      deadlift: grad.deadlift === true,
      allPassed: grad.allPassed === true,
    };
  }, [metadata]);

  const graduationTargets = useMemo(() => {
    if (!isMutenroshi || !config) return [];
    const bodyweight = typeof config.bodyweight === 'number' ? config.bodyweight : 0;
    const gender = typeof config.gender === 'string' ? config.gender : 'male';
    const rounding = typeof config.rounding === 'string' ? parseFloat(config.rounding) : 2.5;
    return computeGraduationTargets(bodyweight, gender, rounding);
  }, [isMutenroshi, config]);

  const handleGraduationStartJaw = (estimatedTMs: Record<string, number>): void => {
    updateMetadata({ graduation: { ...graduationState, allPassed: true }, estimatedTMs });
    onBackToDashboard?.();
  };

  const handleGraduationDismiss = (): void => {
    updateMetadata({ graduation: { ...graduationState, dismissed: true } });
  };

  return {
    isMutenroshi,
    graduationState,
    graduationTargets,
    handleGraduationStartJaw,
    handleGraduationDismiss,
  };
}
