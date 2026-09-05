import { useQueryClient } from '@tanstack/react-query';
import { requireLiveQuery } from '../../lib/programs/program-queries';
import {
  computeGenericProgram,
  previewSlotOutcome,
  ProgramDefinitionSchema,
  type GenericProgramDetail,
  type ProgramDefinition,
  type SetLogEntry,
} from '@gzclp/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import {
  getProgramDefinition,
  getProgramDetail,
  upsertProgramDefinition,
  upsertProgramDetail,
} from '../../lib/tracker/program-detail-repository';
import { getSetDrafts, saveSetDrafts } from '../../lib/tracker/set-draft-repository';
import { getActiveLocalDataOwner } from '../../lib/db/client';
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
import { colors, spacing, type } from '../../shell/design';
import { useRestTimer } from '../../shell/rest-timer-provider';
import { restSecondsForRole } from '../../lib/rest/rest-timer';
import { Chip } from '../../ui/chip';
import { Card } from '../../ui/card';
import {
  firstPendingWorkout,
  isWorkoutComplete,
  recordedWorkoutVolume,
} from './workout-navigation';
import { Button } from '../../ui/button';
import Ionicons from '@expo/vector-icons/Ionicons';
import { IconButton } from '../../ui/icon-button';
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
  const { t, i18n } = useTranslation();
  const restTimer = useRestTimer();
  const queryClient = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const [detail, setDetail] = useState<GenericProgramDetail | null>(null);
  const [definition, setDefinition] = useState<ProgramDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [selectedWorkoutIndex, setSelectedWorkoutIndex] = useState(0);
  const [draftLogs, setDraftLogs] = useState<Readonly<Record<string, readonly SetLogEntry[]>>>({});
  const detailRef = useRef<GenericProgramDetail | null>(null);
  const draftLogsRef = useRef<Readonly<Record<string, readonly SetLogEntry[]>>>({});
  const localStateVersionRef = useRef(0);
  const draftEditRef = useRef<Promise<void>>(Promise.resolve());

  function enqueueDraftEdit(edit: () => Promise<void>): Promise<void> {
    const ownerId = getActiveLocalDataOwner();
    draftEditRef.current = draftEditRef.current
      .then(async () => {
        if (getActiveLocalDataOwner() !== ownerId) return;
        await edit();
      })
      .catch(() => {
        setSyncNotice(t('tracker.notices.draft_failed'));
      });
    return draftEditRef.current;
  }

  async function persistDraftLogs(
    nextDraftLogs: Readonly<Record<string, readonly SetLogEntry[]>>
  ): Promise<void> {
    await saveSetDrafts(programInstanceId, nextDraftLogs);
    setDraftLogsState(nextDraftLogs);
  }

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
        const restoredDrafts = await getSetDrafts(programInstanceId);
        if (!active) return;
        setDraftLogsState(restoredDrafts);
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

        if (cachedDetail !== null && cachedDefinition !== null) {
          if (!active) {
            return;
          }

          setDetailState(cachedDetail);
          setDefinition(cachedDefinition);
          setLoading(false);
          setSyncNotice(null);
          const cachedRows = computeGenericProgram(
            cachedDefinition,
            cachedDetail.config,
            cachedDetail.results
          );
          const pending = firstPendingWorkout(cachedRows);
          setSelectedWorkoutIndex(pending >= 0 ? pending : Math.max(0, cachedRows.length - 1));
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

          const freshDetail = await queryClient.fetchQuery({
            queryKey: ['program-detail', programInstanceId],
            // SQLite/outbox remains authoritative for local writes. Revalidate
            // on entry while deduplicating simultaneous requests for the same id.
            staleTime: 0,
            queryFn: async ({ signal }) => {
              const fetched = await fetchProgramDetail(programInstanceId);
              requireLiveQuery(signal);
              return fetched;
            },
          });
          if (!active) return;
          const inlineDefinition = resolveProgramDefinition(freshDetail);
          const freshDefinition =
            inlineDefinition ??
            (await queryClient.fetchQuery<ProgramDefinition>({
              queryKey: ['program-definition', freshDetail.programId],
              queryFn: async ({ signal }) => {
                const fetched = await fetchProgramDefinition(freshDetail.programId);
                requireLiveQuery(signal);
                return fetched;
              },
            }));
          if (!active) return;

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
            const freshRows = computeGenericProgram(
              freshDefinition,
              freshDetail.config,
              freshDetail.results
            );
            const pending = firstPendingWorkout(freshRows);
            setSelectedWorkoutIndex(pending >= 0 ? pending : Math.max(0, freshRows.length - 1));
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
  }, [programInstanceId, queryClient]);

  const rows = useMemo(() => {
    if (!detail || !definition) {
      return [];
    }

    return computeGenericProgram(definition, detail.config, detail.results);
  }, [definition, detail]);

  const selectedRow = rows[selectedWorkoutIndex];
  const workoutsPerWeek = definition?.workoutsPerWeek ?? 3;
  const weekIndex = Math.floor(selectedWorkoutIndex / workoutsPerWeek);
  const firstPendingIdx = firstPendingWorkout(rows);
  const completed = selectedRow !== undefined && isWorkoutComplete(selectedRow);
  const previews = useMemo(() => {
    if (!completed || !definition || !detail || !selectedRow) return [];
    return selectedRow.slots.flatMap((slot) => {
      if (slot.result === undefined) return [];
      const preview = previewSlotOutcome(
        definition,
        detail.config,
        detail.results,
        selectedRow.index,
        slot.slotId,
        slot.result
      );
      return preview ? [{ name: slot.exerciseName, ...preview.next }] : [];
    });
  }, [completed, definition, detail, selectedRow]);

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

    if (
      setLogs === undefined &&
      (draftLogsRef.current[slotLogKey(workoutIndex, slotId)]?.length ?? 0) > 0
    )
      return;

    const previousDetail = currentDetail;
    const currentSlot = currentDetail.results[String(workoutIndex)]?.[slotId];
    const nextDetail = patchSlotMetrics(currentDetail, workoutIndex, slotId, {
      result,
      ...(result === 'fail'
        ? {
            amrapReps: undefined,
            rpe: undefined,
            setLogs: setLogs !== undefined ? [...setLogs] : undefined,
          }
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
      setSyncNotice(t('tracker.notices.draft_failed'));
      return;
    }

    setDraftLogsState(nextDraftLogs);

    try {
      await queueRecordResultMutation({
        instanceId: currentDetail.id,
        workoutIndex,
        slotId,
        result,
        ...(setLogs !== undefined ? { setLogs: toMutationSetLogs(setLogs) } : {}),
      });
      setSyncNotice(null);
    } catch {
      setSyncNotice(t('tracker.notices.manual_retry'));
    }
  }

  async function handleConfirmSet(
    workoutIndex: number,
    slotId: string,
    entry: SetLogEntry
  ): Promise<void> {
    const row = rows[workoutIndex];
    const slot = row?.slots.find((candidate) => candidate.slotId === slotId);

    if (!slot || slot.result !== undefined) {
      return;
    }

    const key = slotLogKey(workoutIndex, slotId);
    const currentLogs = draftLogsRef.current[key] ?? slot.setLogs;
    const nextLogs = appendSetLog(currentLogs, entry);

    if (nextSetIndex(nextLogs) < slot.sets) {
      await persistDraftLogs({
        ...draftLogsRef.current,
        [key]: nextLogs,
      });
      restTimer.start(restSecondsForRole(slot.role));
      return;
    }

    await handleMarkResult(
      workoutIndex,
      slotId,
      deriveCompletedSlotResult(nextLogs, slot.reps),
      nextLogs
    );
    if (detailRef.current?.results[String(workoutIndex)]?.[slotId]?.result !== undefined) {
      restTimer.skip();
    }
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

  async function handleUndoDraft(workoutIndex: number, slotId: string): Promise<void> {
    const key = slotLogKey(workoutIndex, slotId);
    const currentDraft = draftLogsRef.current[key];
    if (!currentDraft?.length) return;
    const nextDraft = popSetLog(currentDraft);
    const nextDraftLogs = { ...draftLogsRef.current };
    if (nextDraft === undefined) delete nextDraftLogs[key];
    else nextDraftLogs[key] = nextDraft;
    await persistDraftLogs(nextDraftLogs);
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
  const canUndo = (detail?.undoHistory.length ?? 0) > 0;

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [selectedWorkoutIndex, completed]);

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
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View style={styles.chrome}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.eyebrow}>{t('tracker.session_title')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('tracker.back_programs')}
              onPress={onBack}
              style={styles.programPicker}
            >
              <Text style={styles.programName}>{detail.name}</Text>
              <Ionicons accessible={false} name="chevron-down" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
          <IconButton
            name="arrow-undo-outline"
            label={t('tracker.undo_accessibility')}
            disabled={!canUndo}
            onPress={() => {
              void enqueueDraftEdit(handleUndoLast);
            }}
          />
        </View>
        <View style={styles.sessionMeta}>
          <Text style={styles.sessionPosition}>
            {t('tracker.session_position', {
              week: weekIndex + 1,
              day: (selectedWorkoutIndex % workoutsPerWeek) + 1,
            })}
          </Text>
          <Text style={styles.date}>
            <Text>{selectedRow.dayName}</Text> ·{' '}
            {new Date(
              detail.completedDates[String(selectedWorkoutIndex)] ?? Date.now()
            ).toLocaleDateString(i18n.language, { month: 'short', day: 'numeric' })}
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 4 }}
        >
          {Array.from({ length: Math.ceil(rows.length / workoutsPerWeek) }, (_, week) => (
            <Chip
              key={week}
              selected={week === weekIndex}
              onPress={() => setSelectedWorkoutIndex(week * workoutsPerWeek)}
            >
              {t('tracker.week', { week: week + 1 })}
            </Chip>
          ))}
        </ScrollView>
        <View style={styles.daySelector}>
          <IconButton
            name="chevron-back"
            label={t('tracker.previous_accessibility')}
            disabled={selectedWorkoutIndex === 0}
            onPress={() => setSelectedWorkoutIndex((current) => Math.max(0, current - 1))}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.days}
          >
            {rows
              .slice(weekIndex * workoutsPerWeek, (weekIndex + 1) * workoutsPerWeek)
              .map((row, day) => (
                <Pressable
                  key={row.index}
                  accessibilityRole="button"
                  accessibilityLabel={t('tracker.day', { day: day + 1 })}
                  accessibilityState={{ selected: row.index === selectedWorkoutIndex }}
                  onPress={() => setSelectedWorkoutIndex(row.index)}
                  style={[styles.day, row.index === selectedWorkoutIndex && styles.daySelected]}
                >
                  <Text
                    style={[
                      styles.dayLabel,
                      row.index === selectedWorkoutIndex && styles.dayLabelSelected,
                    ]}
                  >
                    {t('tracker.day', { day: day + 1 })}
                  </Text>
                  {isWorkoutComplete(row) ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={row.index === selectedWorkoutIndex ? colors.onAccent : colors.ok}
                    />
                  ) : null}
                </Pressable>
              ))}
          </ScrollView>
          <IconButton
            name="chevron-forward"
            label={t('tracker.next_accessibility')}
            disabled={selectedWorkoutIndex >= rows.length - 1}
            onPress={() =>
              setSelectedWorkoutIndex((current) => Math.min(rows.length - 1, current + 1))
            }
          />
        </View>
        <View style={styles.progressRow}>
          <Text style={styles.progressText}>
            {t('tracker.session_progress', {
              done: selectedRow.slots.filter((slot) => slot.result !== undefined).length,
              total: selectedRow.slots.length,
            })}
          </Text>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${(selectedRow.slots.filter((slot) => slot.result !== undefined).length / Math.max(1, selectedRow.slots.length)) * 100}%`,
                },
              ]}
            />
          </View>
        </View>
        {syncNotice ? <Text style={styles.syncNotice}>{syncNotice}</Text> : null}
        {completed ? (
          <Card>
            <Text style={styles.title}>{t('tracker.day_complete')}</Text>
            <Text style={styles.body}>
              {t('tracker.recorded_volume', { volume: recordedWorkoutVolume(selectedRow) })}
            </Text>
            <Text style={styles.eyebrow}>{t('tracker.next_time_title')}</Text>
            {previews.map((preview) => (
              <View key={preview.name} style={styles.previewRow}>
                <Text style={styles.previewName}>{preview.name}</Text>
                <Text style={styles.previewValue}>
                  {t('tracker.weight', { weight: preview.weight })} ·{' '}
                  {t('tracker.sets_reps', { sets: preview.sets, reps: preview.reps })}
                </Text>
              </View>
            ))}
            {firstPendingIdx >= 0 ? (
              <Button
                variant="primary"
                accessibilityLabel={t('tracker.continue_pending')}
                onPress={() => setSelectedWorkoutIndex(firstPendingIdx)}
              >
                {t('tracker.next_workout')}
              </Button>
            ) : (
              <Text style={styles.body}>{t('tracker.program_complete')}</Text>
            )}
          </Card>
        ) : null}
        {selectedRow.slots.map((slot) => (
          <TrackerSlotCard
            key={slot.slotId}
            slot={slot}
            variant={slot.slotId === heroSlotId ? 'hero' : 'queue'}
            workoutIndex={selectedRow.index}
            draftLogs={
              slot.result === undefined
                ? draftLogs[slotLogKey(selectedRow.index, slot.slotId)]
                : undefined
            }
            onConfirmSet={(workoutIndexValue, slotIdValue, entry) => {
              return enqueueDraftEdit(() =>
                handleConfirmSet(workoutIndexValue, slotIdValue, entry)
              );
            }}
            onUndoSet={(workoutIndexValue, slotIdValue) => {
              void enqueueDraftEdit(() => handleUndoDraft(workoutIndexValue, slotIdValue));
            }}
            onMarkResult={(workoutIndexValue, slotIdValue, result) => {
              enqueueDraftEdit(() => handleMarkResult(workoutIndexValue, slotIdValue, result));
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
    paddingBottom: 24,
    gap: 10,
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
    alignItems: 'center',
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
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  previewName: { ...type.body, fontSize: 14, lineHeight: 20, flex: 1 },
  previewValue: { ...type.body, color: colors.textPrimary, fontSize: 14, lineHeight: 20 },
  eyebrow: { ...type.body, fontSize: 13, lineHeight: 18 },
  programPicker: { flexDirection: 'row', alignItems: 'center', minHeight: 44, gap: 8 },
  programName: { ...type.displaySm, flexShrink: 1 },
  sessionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  sessionPosition: { ...type.kicker, fontSize: 10, color: colors.textSecondary },
  date: { ...type.body, fontSize: 12, lineHeight: 18 },
  daySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 4,
  },
  days: { flexGrow: 1, justifyContent: 'space-around', gap: 4 },
  day: {
    minHeight: 44,
    minWidth: 64,
    paddingHorizontal: 10,
    borderRadius: 10,
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: colors.accent },
  dayLabel: { ...type.button, color: colors.textMuted, fontSize: 13 },
  dayLabelSelected: { color: colors.onAccent },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  progressText: { ...type.body, fontSize: 12, lineHeight: 18 },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.rule,
    overflow: 'hidden',
  },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: colors.ok },
});
