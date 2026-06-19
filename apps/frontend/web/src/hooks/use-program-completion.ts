import { useMemo, useState } from 'react';
import type { ProgramDefinition } from '@gzclp/domain/types/program';
import type { GenericWorkoutRow } from '@gzclp/domain/types';
import { computeProfileData, compute1RMData } from '@/lib/profile-stats';
import { trackEvent } from '@/lib/analytics';

interface UseProgramCompletionOptions {
  readonly instanceId: string | undefined;
  readonly programId: string;
  readonly definition: ProgramDefinition | undefined;
  readonly config: Record<string, number | string> | null;
  readonly rows: readonly GenericWorkoutRow[];
  readonly resultTimestamps: Readonly<Record<string, string>> | undefined;
  readonly mutenroshiBlocksCompletion: boolean;
  readonly finishProgram: () => Promise<void>;
  readonly onBackToDashboard?: () => void;
  readonly onGoToProfile?: () => void;
}

interface CompletionData {
  readonly completion: ReturnType<typeof computeProfileData>['completion'];
  readonly personalRecords: ReturnType<typeof computeProfileData>['personalRecords'];
  readonly oneRMEstimates: ReturnType<typeof compute1RMData>;
  readonly totalVolume: ReturnType<typeof computeProfileData>['volume']['totalVolume'];
}

interface UseProgramCompletionReturn {
  readonly showCompletion: boolean;
  readonly completionData: CompletionData | null;
  readonly handleFinishProgram: () => Promise<void>;
  readonly handleCompletionDismiss: () => void;
  readonly handleViewProfile: () => void;
}

export function useProgramCompletion({
  instanceId,
  programId,
  definition,
  config,
  rows,
  resultTimestamps,
  mutenroshiBlocksCompletion,
  finishProgram,
  onBackToDashboard,
  onGoToProfile,
}: UseProgramCompletionOptions): UseProgramCompletionReturn {
  const [showCompletion, setShowCompletion] = useState(false);

  const completionSessionKey = instanceId !== undefined ? `completion-shown-${instanceId}` : null;

  const shouldShowCompletion = showCompletion && !mutenroshiBlocksCompletion;

  const completionData = useMemo((): CompletionData | null => {
    if (!shouldShowCompletion || !definition || !config) return null;
    const profileData = computeProfileData(rows, definition, config, resultTimestamps);
    const oneRMEstimates = compute1RMData(rows, definition);
    return {
      completion: profileData.completion,
      personalRecords: profileData.personalRecords,
      oneRMEstimates,
      totalVolume: profileData.volume.totalVolume,
    };
  }, [shouldShowCompletion, definition, config, rows, resultTimestamps]);

  const handleFinishProgram = async (): Promise<void> => {
    if (completionSessionKey && sessionStorage.getItem(completionSessionKey) === '1') {
      await finishProgram();
      onBackToDashboard?.();
      return;
    }
    await finishProgram();
    trackEvent('program_complete', { program: programId });
    if (completionSessionKey) sessionStorage.setItem(completionSessionKey, '1');
    setShowCompletion(true);
  };

  const handleCompletionDismiss = (): void => {
    setShowCompletion(false);
    onBackToDashboard?.();
  };

  const handleViewProfile = (): void => {
    setShowCompletion(false);
    onGoToProfile?.();
  };

  return {
    showCompletion,
    completionData,
    handleFinishProgram,
    handleCompletionDismiss,
    handleViewProfile,
  };
}
