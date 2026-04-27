import {
  computeGenericProgram,
  ProgramDefinitionSchema,
  type GenericProgramDetail,
  type ProgramDefinition,
} from '@gzclp/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  getProgramDefinition,
  getProgramDetail,
  upsertProgramDefinition,
  upsertProgramDetail,
} from '../../lib/tracker/program-detail-repository';
import { getAccessToken } from '../../lib/auth/session';
import {
  fetchProgramDefinition,
  fetchProgramDetail,
} from '../../lib/tracker/program-detail-service';
import {
  queueRecordResultMutation,
  queueUndoRestoreMutation,
} from '../../lib/tracker/tracker-mutation-service';
import { flushQueuedMutations } from '../../lib/sync/mutation-sync-service';
import { applyUndoEntry, buildUndoEntry, patchSlotMetrics, slotStateEqual } from './tracker-state';
import { TrackerSlotCard } from './tracker-slot-card';

type TrackerScreenProps = {
  readonly programInstanceId: string;
  readonly onBack: () => void;
};

const LOCAL_SYNC_RETRY_NOTICE = 'Saved locally. Sync will retry.';
const LOCAL_SYNC_MANUAL_RETRY_NOTICE = "Saved locally. This change won't sync automatically.";
const MAX_RPE = 10;

function resolveProgramDefinition(detail: GenericProgramDetail): ProgramDefinition | null {
  try {
    return ProgramDefinitionSchema.parse(detail.customDefinition);
  } catch {
    return null;
  }
}

export function TrackerScreen({ programInstanceId, onBack }: TrackerScreenProps) {
  const [detail, setDetail] = useState<GenericProgramDetail | null>(null);
  const [definition, setDefinition] = useState<ProgramDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [selectedWorkoutIndex, setSelectedWorkoutIndex] = useState(0);
  const detailRef = useRef<GenericProgramDetail | null>(null);
  const localStateVersionRef = useRef(0);

  function setDetailState(nextDetail: GenericProgramDetail | null): void {
    detailRef.current = nextDetail;
    setDetail(nextDetail);
  }

  useEffect(() => {
    let active = true;

    async function loadTracker(): Promise<void> {
      try {
        const cachedDetail = await getProgramDetail(programInstanceId);
        const cachedDefinition = cachedDetail
          ? (resolveProgramDefinition(cachedDetail) ??
            (await getProgramDefinition(cachedDetail.programId)))
          : null;
        const hasCachedTracker = cachedDetail !== null && cachedDefinition !== null;

        if (hasCachedTracker) {
          if (!active) {
            return;
          }

          setDetailState(cachedDetail);
          setDefinition(cachedDefinition);
          setLoading(false);
          setSyncNotice(null);
          setSelectedWorkoutIndex(0);
        }

        try {
          const refreshLocalStateVersion = localStateVersionRef.current;
          const currentAccessToken = getAccessToken();
          if (currentAccessToken) {
            try {
              await flushQueuedMutations(currentAccessToken);
            } catch {
              if (hasCachedTracker) {
                setSyncNotice('Showing cached tracker data while sync catches up.');
                setLoading(false);
                return;
              }
            }
          }

          const freshDetail = await fetchProgramDetail(programInstanceId);
          const inlineDefinition = resolveProgramDefinition(freshDetail);
          const freshDefinition =
            inlineDefinition ?? (await fetchProgramDefinition(freshDetail.programId));

          if (inlineDefinition === null) {
            await upsertProgramDefinition(freshDefinition);
          }

          if (!hasCachedTracker || localStateVersionRef.current === refreshLocalStateVersion) {
            await upsertProgramDetail(freshDetail);
          }

          if (!active) {
            return;
          }

          setDefinition(freshDefinition);
          setLoading(false);
          setSyncNotice(null);
          if (!hasCachedTracker) {
            setSelectedWorkoutIndex(0);
          }

          if (!hasCachedTracker || localStateVersionRef.current === refreshLocalStateVersion) {
            setDetailState(freshDetail);
          }
        } catch {
          if (!active) {
            return;
          }

          if (hasCachedTracker) {
            setSyncNotice('Showing cached tracker data while sync catches up.');
            setLoading(false);
            return;
          }

          throw new Error('Missing tracker bootstrap data');
        }
      } catch {
        if (!active) {
          return;
        }

        setLoading(false);
      }
    }

    void loadTracker();

    return () => {
      active = false;
    };
  }, [programInstanceId]);

  const rows = useMemo(() => {
    if (!detail || !definition) {
      return [];
    }

    return computeGenericProgram(definition, detail.config, detail.results);
  }, [definition, detail]);

  const selectedRow = rows[selectedWorkoutIndex];

  async function handleMarkResult(
    workoutIndex: number,
    slotId: string,
    result: 'success' | 'fail'
  ): Promise<void> {
    const currentDetail = detailRef.current;

    if (!currentDetail) {
      return;
    }

    const previousDetail = currentDetail;
    const currentSlot = currentDetail.results[String(workoutIndex)]?.[slotId];
    const nextDetail = patchSlotMetrics(currentDetail, workoutIndex, slotId, {
      result,
      ...(result === 'fail' ? { amrapReps: undefined, rpe: undefined, setLogs: undefined } : {}),
    });
    const nextSlot = nextDetail.results[String(workoutIndex)]?.[slotId];

    if (slotStateEqual(currentSlot, nextSlot)) {
      return;
    }

    const nextUndoEntry = buildUndoEntry(currentDetail, workoutIndex, slotId);
    const writeVersion = localStateVersionRef.current + 1;
    localStateVersionRef.current = writeVersion;
    setDetailState({
      ...nextDetail,
      undoHistory: [...currentDetail.undoHistory, nextUndoEntry],
    });

    try {
      await upsertProgramDetail({
        ...nextDetail,
        undoHistory: [...currentDetail.undoHistory, nextUndoEntry],
      });
    } catch {
      if (localStateVersionRef.current !== writeVersion) {
        return;
      }

      localStateVersionRef.current += 1;
      setDetailState(previousDetail);
      return;
    }

    try {
      await queueRecordResultMutation({
        instanceId: currentDetail.id,
        workoutIndex,
        slotId,
        result,
      });
      setSyncNotice((current) => (current === LOCAL_SYNC_RETRY_NOTICE ? null : current));
    } catch {
      setSyncNotice(LOCAL_SYNC_MANUAL_RETRY_NOTICE);
    }
  }

  async function persistSlotUpdate(
    workoutIndex: number,
    slotId: string,
    patch: {
      readonly result?: 'success' | 'fail';
      readonly amrapReps?: number | undefined;
      readonly rpe?: number | undefined;
    }
  ): Promise<void> {
    const currentDetail = detailRef.current;

    if (!currentDetail) {
      return;
    }

    const previousDetail = currentDetail;
    const currentSlot = currentDetail.results[String(workoutIndex)]?.[slotId];
    const nextDetail = patchSlotMetrics(currentDetail, workoutIndex, slotId, patch);
    const nextSlot = nextDetail.results[String(workoutIndex)]?.[slotId];

    if (!nextSlot || nextSlot.result !== 'success') {
      return;
    }

    if (slotStateEqual(currentSlot, nextSlot)) {
      return;
    }

    const nextUndoEntry = buildUndoEntry(currentDetail, workoutIndex, slotId);
    const nextDetailWithUndo = {
      ...nextDetail,
      undoHistory: [...currentDetail.undoHistory, nextUndoEntry],
    };

    const writeVersion = localStateVersionRef.current + 1;
    localStateVersionRef.current = writeVersion;
    setDetailState(nextDetailWithUndo);

    try {
      await upsertProgramDetail(nextDetailWithUndo);
    } catch {
      if (localStateVersionRef.current !== writeVersion) {
        return;
      }

      localStateVersionRef.current += 1;
      setDetailState(previousDetail);
      return;
    }

    try {
      await queueRecordResultMutation({
        instanceId: currentDetail.id,
        workoutIndex,
        slotId,
        result: nextSlot.result,
        ...(nextSlot.amrapReps !== undefined ? { amrapReps: nextSlot.amrapReps } : {}),
        ...(nextSlot.rpe !== undefined ? { rpe: nextSlot.rpe } : {}),
        ...(nextSlot.setLogs !== undefined ? { setLogs: nextSlot.setLogs } : {}),
      });
      setSyncNotice((current) => (current === LOCAL_SYNC_RETRY_NOTICE ? null : current));
    } catch {
      setSyncNotice(LOCAL_SYNC_MANUAL_RETRY_NOTICE);
    }
  }

  async function handleMetricChange(
    workoutIndex: number,
    slotId: string,
    metric: 'amrapReps' | 'rpe',
    currentValue: number | undefined,
    direction: -1 | 1
  ): Promise<void> {
    if (currentValue === undefined && direction < 0) {
      return;
    }

    const nextValue = currentValue === undefined ? 1 : currentValue + direction;

    if (metric === 'amrapReps') {
      await persistSlotUpdate(workoutIndex, slotId, {
        amrapReps: nextValue <= 0 ? undefined : nextValue,
      });
      return;
    }

    await persistSlotUpdate(workoutIndex, slotId, {
      rpe: nextValue <= 0 ? undefined : Math.min(nextValue, MAX_RPE),
    });
  }

  async function handleClearMetric(
    workoutIndex: number,
    slotId: string,
    metric: 'amrapReps' | 'rpe'
  ): Promise<void> {
    await persistSlotUpdate(workoutIndex, slotId, {
      [metric]: undefined,
    });
  }

  async function handleUndoLast(): Promise<void> {
    const currentDetail = detailRef.current;
    const currentUndoEntry = currentDetail?.undoHistory[currentDetail.undoHistory.length - 1];

    if (!currentDetail || !currentUndoEntry) {
      return;
    }

    const previousDetail = currentDetail;
    const restoredDetail = applyUndoEntry(currentDetail, currentUndoEntry);
    const nextDetail = {
      ...restoredDetail,
      undoHistory: currentDetail.undoHistory.slice(0, -1),
    };
    const writeVersion = localStateVersionRef.current + 1;
    localStateVersionRef.current = writeVersion;
    setDetailState(nextDetail);

    try {
      await upsertProgramDetail(nextDetail);
    } catch {
      if (localStateVersionRef.current !== writeVersion) {
        return;
      }

      localStateVersionRef.current += 1;
      setDetailState(previousDetail);
      return;
    }

    try {
      const restoredSlot =
        nextDetail.results[String(currentUndoEntry.i)]?.[currentUndoEntry.slotId];

      await queueUndoRestoreMutation({
        instanceId: currentDetail.id,
        workoutIndex: currentUndoEntry.i,
        slotId: currentUndoEntry.slotId,
        ...(restoredSlot?.result !== undefined ? { result: restoredSlot.result } : {}),
        ...(restoredSlot?.amrapReps !== undefined ? { amrapReps: restoredSlot.amrapReps } : {}),
        ...(restoredSlot?.rpe !== undefined ? { rpe: restoredSlot.rpe } : {}),
        ...(restoredSlot?.setLogs !== undefined ? { setLogs: restoredSlot.setLogs } : {}),
      });
      setSyncNotice((current) => (current === LOCAL_SYNC_RETRY_NOTICE ? null : current));
    } catch {
      setSyncNotice(LOCAL_SYNC_MANUAL_RETRY_NOTICE);
    }
  }

  const canUndo = (detail?.undoHistory.length ?? 0) > 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBlock}>
          <Text style={styles.body}>Loading tracker...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!detail || !definition || !selectedRow) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBlock}>
          <Text style={styles.title}>Tracker unavailable</Text>
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
            <Text style={styles.backLabel}>Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backLabel}>Back to programs</Text>
        </Pressable>
        <View style={styles.toolbarRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous workout"
            disabled={selectedWorkoutIndex === 0}
            onPress={() => setSelectedWorkoutIndex((current) => Math.max(0, current - 1))}
            style={[styles.navButton, selectedWorkoutIndex === 0 ? styles.navButtonDisabled : null]}
          >
            <Text style={styles.navLabel}>Prev</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo latest tracker action"
            disabled={!canUndo}
            onPress={() => {
              void handleUndoLast();
            }}
            style={[styles.navButton, !canUndo ? styles.navButtonDisabled : null]}
          >
            <Text style={styles.navLabel}>Undo</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next workout"
            disabled={selectedWorkoutIndex >= rows.length - 1}
            onPress={() =>
              setSelectedWorkoutIndex((current) => Math.min(rows.length - 1, current + 1))
            }
            style={[
              styles.navButton,
              selectedWorkoutIndex >= rows.length - 1 ? styles.navButtonDisabled : null,
            ]}
          >
            <Text style={styles.navLabel}>Next</Text>
          </Pressable>
        </View>
        <Text style={styles.eyebrow}>{detail.name}</Text>
        <Text style={styles.title}>{selectedRow.dayName}</Text>
        {syncNotice ? <Text style={styles.syncNotice}>{syncNotice}</Text> : null}
        {selectedRow.slots.map((slot) => (
          <TrackerSlotCard
            key={slot.slotId}
            slot={slot}
            workoutIndex={selectedRow.index}
            onMarkResult={(workoutIndexValue, slotIdValue, result) => {
              void handleMarkResult(workoutIndexValue, slotIdValue, result);
            }}
            onMetricChange={(workoutIndexValue, slotIdValue, metric, currentValue, direction) => {
              void handleMetricChange(
                workoutIndexValue,
                slotIdValue,
                metric,
                currentValue,
                direction
              );
            }}
            onClearMetric={(workoutIndexValue, slotIdValue, metric) => {
              void handleClearMetric(workoutIndexValue, slotIdValue, metric);
            }}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#050816',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 14,
  },
  centerBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  eyebrow: {
    color: '#8B9AF4',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 30,
    fontWeight: '700',
  },
  body: {
    color: '#CBD5E1',
    fontSize: 16,
  },
  syncNotice: {
    color: '#FBBF24',
    fontSize: 14,
    lineHeight: 20,
  },
  toolbarRow: {
    flexDirection: 'row',
    gap: 10,
  },
  backButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '600',
  },
  navButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  navButtonDisabled: {
    opacity: 0.45,
  },
  navLabel: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
});
