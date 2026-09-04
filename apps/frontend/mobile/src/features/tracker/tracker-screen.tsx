import {
  computeGenericProgram,
  ProgramDefinitionSchema,
  type GenericProgramDetail,
  type ProgramDefinition,
  type SetLogEntry,
} from '@gzclp/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

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
import {
  appendSetLog,
  deriveCompletedSlotResult,
  nextSetIndex,
  popSetLog,
  slotLogKey,
} from './tracker-set-logging';
import { colors, spacing, type } from '../../app/design';
import { Button } from '../../ui/button';
import { Kicker } from '../../ui/kicker';
import { Screen } from '../../ui/screen';

type TrackerScreenProps = {
  readonly programInstanceId: string;
  readonly onBack: () => void;
};

const MAX_RPE = 10;

function toMutationSetLogs(entries: readonly SetLogEntry[]): Array<{
  readonly reps: number;
  readonly weight?: number;
  readonly rpe?: number;
}> {
  return entries.map((entry) => ({
    reps: entry.reps,
    ...(entry.weight !== undefined ? { weight: entry.weight } : {}),
    ...(entry.rpe !== undefined ? { rpe: entry.rpe } : {}),
  }));
}

function resolveProgramDefinition(detail: GenericProgramDetail): ProgramDefinition | null {
  try {
    return ProgramDefinitionSchema.parse(detail.customDefinition);
  } catch {
    return null;
  }
}

export function TrackerScreen({ programInstanceId, onBack }: TrackerScreenProps) {
  const { t } = useTranslation();
  const [detail, setDetail] = useState<GenericProgramDetail | null>(null);
  const [definition, setDefinition] = useState<ProgramDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [selectedWorkoutIndex, setSelectedWorkoutIndex] = useState(0);
  const [draftLogs, setDraftLogs] = useState<Readonly<Record<string, readonly SetLogEntry[]>>>({});
  const detailRef = useRef<GenericProgramDetail | null>(null);
  const draftLogsRef = useRef<Readonly<Record<string, readonly SetLogEntry[]>>>({});
  const localStateVersionRef = useRef(0);

  function setDraftLogsState(
    nextDraftLogs: Readonly<Record<string, readonly SetLogEntry[]>>
  ): void {
    draftLogsRef.current = nextDraftLogs;
    setDraftLogs(nextDraftLogs);
  }

  function setDetailState(nextDetail: GenericProgramDetail | null): void {
    detailRef.current = nextDetail;
    setDetail(nextDetail);
  }

  useEffect(() => {
    let active = true;

    async function loadTracker(): Promise<void> {
      try {
        let cachedDetail: GenericProgramDetail | null = null;
        let cachedDefinition: ProgramDefinition | null = null;
        try {
          cachedDetail = await getProgramDetail(programInstanceId);
          cachedDefinition = cachedDetail
            ? (resolveProgramDefinition(cachedDetail) ??
              (await getProgramDefinition(cachedDetail.programId)))
            : null;
        } catch {
          // A partially written or legacy cache is not authoritative. Continue
          // through the network bootstrap so a healthy server response repairs
          // the row instead of leaving the tracker permanently unavailable.
          cachedDetail = null;
          cachedDefinition = null;
        }
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
                setSyncNotice(t('tracker.notices.cached'));
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
            setSyncNotice(t('tracker.notices.cached'));
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
    result: 'success' | 'fail',
    setLogs?: readonly SetLogEntry[]
  ): Promise<void> {
    const currentDetail = detailRef.current;

    if (!currentDetail) {
      return;
    }

    const previousDetail = currentDetail;
    const currentSlot = currentDetail.results[String(workoutIndex)]?.[slotId];
    const nextDetail = patchSlotMetrics(currentDetail, workoutIndex, slotId, {
      result,
      ...(result === 'fail'
        ? { amrapReps: undefined, rpe: undefined, setLogs: undefined }
        : setLogs !== undefined
          ? { setLogs: [...setLogs] }
          : {}),
    });
    const nextSlot = nextDetail.results[String(workoutIndex)]?.[slotId];

    if (slotStateEqual(currentSlot, nextSlot)) {
      return;
    }

    const nextDraftLogs = { ...draftLogsRef.current };
    delete nextDraftLogs[slotLogKey(workoutIndex, slotId)];
    setDraftLogsState(nextDraftLogs);

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
        ...(result === 'success' && setLogs !== undefined
          ? { setLogs: toMutationSetLogs(setLogs) }
          : {}),
      });
      setSyncNotice(null);
    } catch {
      setSyncNotice(t('tracker.notices.manual_retry'));
    }
  }

  function handleConfirmSet(workoutIndex: number, slotId: string): void {
    const row = rows[workoutIndex];
    const slot = row?.slots.find((candidate) => candidate.slotId === slotId);

    if (!slot || slot.result !== undefined) {
      return;
    }

    const key = slotLogKey(workoutIndex, slotId);
    const currentLogs = draftLogsRef.current[key] ?? slot.setLogs;
    const nextLogs = appendSetLog(currentLogs, { reps: slot.reps, weight: slot.weight });

    if (nextSetIndex(nextLogs) < slot.sets) {
      setDraftLogsState({
        ...draftLogsRef.current,
        [key]: nextLogs,
      });
      return;
    }

    void handleMarkResult(
      workoutIndex,
      slotId,
      deriveCompletedSlotResult(nextLogs, slot.reps),
      nextLogs
    );
  }

  async function persistSlotUpdate(
    workoutIndex: number,
    slotId: string,
    patch: {
      readonly result?: 'success' | 'fail';
      readonly amrapReps?: number | undefined;
      readonly rpe?: number | undefined;
      readonly setLogs?: readonly SetLogEntry[] | undefined;
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
        ...(nextSlot.setLogs !== undefined ? { setLogs: toMutationSetLogs(nextSlot.setLogs) } : {}),
      });
      setSyncNotice(null);
    } catch {
      setSyncNotice(t('tracker.notices.manual_retry'));
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
    const currentSlot = detailRef.current?.results[String(workoutIndex)]?.[slotId];
    const currentLogs = currentSlot?.setLogs;
    const nextLogs =
      metric === 'amrapReps' && currentLogs !== undefined && currentLogs.length > 0
        ? currentLogs.map((entry, index) =>
            index === currentLogs.length - 1
              ? {
                  ...entry,
                  reps: nextValue <= 0 ? entry.reps : nextValue,
                }
              : entry
          )
        : undefined;

    if (metric === 'amrapReps') {
      await persistSlotUpdate(workoutIndex, slotId, {
        amrapReps: nextValue <= 0 ? undefined : nextValue,
        ...(nextLogs !== undefined ? { setLogs: nextLogs } : {}),
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
    if (metric === 'rpe') {
      await persistSlotUpdate(workoutIndex, slotId, {
        rpe: undefined,
      });
      return;
    }

    const slot = rows[workoutIndex]?.slots.find((candidate) => candidate.slotId === slotId);
    const currentLogs = detailRef.current?.results[String(workoutIndex)]?.[slotId]?.setLogs;
    const nextLogs =
      slot !== undefined && currentLogs !== undefined && currentLogs.length > 0
        ? currentLogs.map((entry, index) =>
            index === currentLogs.length - 1 ? { ...entry, reps: slot.reps } : entry
          )
        : currentLogs;

    await persistSlotUpdate(workoutIndex, slotId, {
      amrapReps: undefined,
      ...(nextLogs !== undefined ? { setLogs: nextLogs } : {}),
    });
  }

  async function handleUndoLast(): Promise<void> {
    const selectedDraftRow = rows[selectedWorkoutIndex];
    const draftSlotId =
      selectedDraftRow?.slots.find((slot) => slot.result === undefined)?.slotId ??
      selectedDraftRow?.slots[0]?.slotId;

    if (selectedDraftRow && draftSlotId) {
      const key = slotLogKey(selectedDraftRow.index, draftSlotId);
      const currentDraft = draftLogsRef.current[key];

      if (currentDraft !== undefined && currentDraft.length > 0) {
        const nextDraft = popSetLog(currentDraft);
        const nextDraftLogs = { ...draftLogsRef.current };
        if (nextDraft === undefined) {
          delete nextDraftLogs[key];
        } else {
          nextDraftLogs[key] = nextDraft;
        }
        setDraftLogsState(nextDraftLogs);
        return;
      }
    }

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
        ...(restoredSlot?.setLogs !== undefined
          ? { setLogs: toMutationSetLogs(restoredSlot.setLogs) }
          : {}),
      });
      setSyncNotice(null);
    } catch {
      setSyncNotice(t('tracker.notices.manual_retry'));
    }
  }

  const heroSlotId =
    selectedRow?.slots.find((slot) => slot.result === undefined)?.slotId ??
    selectedRow?.slots[0]?.slotId;
  const heroDraftKey = selectedRow && heroSlotId ? slotLogKey(selectedRow.index, heroSlotId) : null;
  const canUndo =
    (heroDraftKey !== null && (draftLogs[heroDraftKey]?.length ?? 0) > 0) ||
    (detail?.undoHistory.length ?? 0) > 0;

  if (loading) {
    return (
      <Screen>
        <View style={styles.centerBlock}>
          <Text style={styles.body}>{t('tracker.loading')}</Text>
        </View>
      </Screen>
    );
  }

  if (!detail || !definition || !selectedRow) {
    return (
      <Screen>
        <View style={styles.centerBlock}>
          <Text style={styles.title}>{t('tracker.unavailable')}</Text>
          <Button onPress={onBack}>{t('tracker.back')}</Button>
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.chrome}>
          <Button onPress={onBack}>{t('tracker.back_programs')}</Button>
          <Button
            variant="ghost"
            accessibilityLabel={t('tracker.undo_accessibility')}
            disabled={!canUndo}
            onPress={() => {
              void handleUndoLast();
            }}
          >
            {t('tracker.undo')}
          </Button>
        </View>
        <Kicker>{detail.name}</Kicker>
        <Text style={styles.title}>{selectedRow.dayName}</Text>
        <View style={styles.dayNav}>
          <View style={styles.dayNavButton}>
            <Button
              accessibilityLabel={t('tracker.previous_accessibility')}
              disabled={selectedWorkoutIndex === 0}
              onPress={() => setSelectedWorkoutIndex((current) => Math.max(0, current - 1))}
            >
              {t('tracker.previous')}
            </Button>
          </View>
          <View style={styles.dayNavButton}>
            <Button
              accessibilityLabel={t('tracker.next_accessibility')}
              disabled={selectedWorkoutIndex >= rows.length - 1}
              onPress={() =>
                setSelectedWorkoutIndex((current) => Math.min(rows.length - 1, current + 1))
              }
            >
              {t('tracker.next')}
            </Button>
          </View>
        </View>
        {syncNotice ? <Text style={styles.syncNotice}>{syncNotice}</Text> : null}
        {selectedRow.slots.map((slot) => (
          <TrackerSlotCard
            key={slot.slotId}
            slot={slot}
            variant={slot.slotId === heroSlotId ? 'hero' : 'queue'}
            workoutIndex={selectedRow.index}
            draftLogs={draftLogs[slotLogKey(selectedRow.index, slot.slotId)]}
            onConfirmSet={(workoutIndexValue, slotIdValue) => {
              handleConfirmSet(workoutIndexValue, slotIdValue);
            }}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 14,
  },
  centerBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  chrome: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  title: {
    ...type.display,
  },
  body: {
    ...type.body,
  },
  syncNotice: {
    color: colors.warn,
    fontSize: 14,
    lineHeight: 20,
  },
  dayNav: {
    flexDirection: 'row',
    gap: 10,
  },
  dayNavButton: {
    flex: 1,
  },
});
