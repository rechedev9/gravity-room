import { useState } from 'react';
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
  // Snapshot taken just before finishing: once the program is finished there is no active
  // program left, so its config and rows are gone by the time the screen renders.
  const [completionData, setCompletionData] = useState<CompletionData | null>(null);

  const completionSessionKey = instanceId !== undefined ? `completion-shown-${instanceId}` : null;

  const snapshotCompletion = (): CompletionData | null => {
    if (mutenroshiBlocksCompletion || !definition || !config) return null;
    const profileData = computeProfileData(rows, definition, config, resultTimestamps);
    return {
      completion: profileData.completion,
      personalRecords: profileData.personalRecords,
      oneRMEstimates: compute1RMData(rows, definition),
      totalVolume: profileData.volume.totalVolume,
    };
  };

  const handleFinishProgram = async (): Promise<void> => {
    if (completionSessionKey && sessionStorage.getItem(completionSessionKey) === '1') {
      await finishProgram();
      onBackToDashboard?.();
      return;
    }
    const snapshot = snapshotCompletion();
    await finishProgram();
    trackEvent('program_complete', { program: programId });
    if (completionSessionKey) sessionStorage.setItem(completionSessionKey, '1');
    setCompletionData(snapshot);
  };

  const handleCompletionDismiss = (): void => {
    setCompletionData(null);
    onBackToDashboard?.();
  };

  const handleViewProfile = (): void => {
    setCompletionData(null);
    onGoToProfile?.();
  };

  return {
    completionData,
    handleFinishProgram,
    handleCompletionDismiss,
    handleViewProfile,
  };
}
