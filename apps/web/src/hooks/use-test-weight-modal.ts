import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface TestWeightModalState {
  readonly workoutIndex: number;
  readonly slotId: string;
  readonly exerciseName: string;
  readonly prefillWeight: number;
  readonly propagatesTo: string | undefined;
}

interface ConfigSnapshot {
  readonly propagatesTo: string;
  readonly previousValue: number | string | undefined;
}

interface UseTestWeightModalOptions {
  readonly config: Record<string, number | string> | null;
  readonly updateConfigAsync: (config: Record<string, number | string>) => Promise<void>;
  readonly clearSetLogs: (workoutIndex: number, slotId: string) => void;
  readonly undoSpecific: (workoutIndex: number, slotId: string) => void;
  readonly recordAndToast: (workoutIndex: number, slotId: string) => void;
  readonly toast: (opts: { readonly message: string }) => void;
}

interface UseTestWeightModalReturn {
  readonly testWeightModal: TestWeightModalState | null;
  readonly testWeightLoading: boolean;
  readonly openTestWeightModal: (state: TestWeightModalState) => void;
  readonly handleTestWeightConfirm: (weight: number) => Promise<void>;
  readonly handleTestWeightCancel: () => void;
  readonly handleUndoSpecific: (workoutIndex: number, slotId: string) => void;
}

export function useTestWeightModal({
  config,
  updateConfigAsync,
  clearSetLogs,
  undoSpecific,
  recordAndToast,
  toast,
}: UseTestWeightModalOptions): UseTestWeightModalReturn {
  const { t } = useTranslation();
  const [testWeightModal, setTestWeightModal] = useState<TestWeightModalState | null>(null);
  const [testWeightLoading, setTestWeightLoading] = useState(false);
  const configSnapshotRef = useRef<Map<string, ConfigSnapshot>>(new Map());

  const openTestWeightModal = (state: TestWeightModalState): void => {
    setTestWeightModal(state);
  };

  const handleTestWeightConfirm = async (weight: number): Promise<void> => {
    if (!testWeightModal) return;
    const { workoutIndex, slotId, propagatesTo } = testWeightModal;

    setTestWeightLoading(true);
    try {
      if (propagatesTo !== undefined && config) {
        const snapshotKey = `${workoutIndex}:${slotId}`;
        configSnapshotRef.current.set(snapshotKey, {
          propagatesTo,
          previousValue: config[propagatesTo],
        });

        try {
          await updateConfigAsync({ [propagatesTo]: weight });
        } catch {
          configSnapshotRef.current.delete(snapshotKey);
          toast({ message: t('tracker.errors.config_update_failed') });
          setTestWeightLoading(false);
          setTestWeightModal(null);
          return;
        }
      }

      recordAndToast(workoutIndex, slotId);
      setTestWeightModal(null);
    } finally {
      setTestWeightLoading(false);
    }
  };

  const handleTestWeightCancel = (): void => {
    setTestWeightModal(null);
  };

  const handleUndoSpecific = (workoutIndex: number, slotId: string): void => {
    clearSetLogs(workoutIndex, slotId);

    const snapshotKey = `${workoutIndex}:${slotId}`;
    const snapshot = configSnapshotRef.current.get(snapshotKey);

    undoSpecific(workoutIndex, slotId);

    if (snapshot) {
      configSnapshotRef.current.delete(snapshotKey);
      const revertValue = snapshot.previousValue;
      if (revertValue !== undefined) {
        updateConfigAsync({ [snapshot.propagatesTo]: revertValue }).catch(() => {
          toast({ message: t('tracker.errors.next_block_revert_failed') });
        });
      }
    }
  };

  return {
    testWeightModal,
    testWeightLoading,
    openTestWeightModal,
    handleTestWeightConfirm,
    handleTestWeightCancel,
    handleUndoSpecific,
  };
}
