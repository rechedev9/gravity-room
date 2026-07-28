import {
  computeGenericProgram,
  ProgramDefinitionSchema,
  type GenericProgramDetail,
  type ProgramDefinition,
} from '@gzclp/domain';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import {
  commitProgramDefinitionRefresh,
  commitProgramDetailRefresh,
  getProgramDefinition,
  getProgramDetail,
  upsertProgramDetail,
} from '../../lib/tracker/program-detail-repository';
import {
  captureAuthorizedSession,
  getAuthorizedSessionAccessToken,
  isAuthorizedSessionCurrent,
  type AuthorizedSession,
} from '../../lib/auth/session';
import {
  abandonProgramRefreshLease,
  captureProgramRefreshLease,
  isProgramRefreshLeaseCurrent,
  type ProgramRefreshLease,
  withProgramRefreshCommitBarrier,
} from '../../lib/programs/program-refresh-generation';
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

function observeRefreshLease(
  promise: Promise<ProgramRefreshLease>
): Promise<PromiseSettledResult<ProgramRefreshLease>> {
  return Promise.resolve(promise).then(
    (value) => ({ status: 'fulfilled', value }),
    (reason: unknown) => ({ status: 'rejected', reason })
  );
}

async function readObservedRefreshLease(
  promise: Promise<PromiseSettledResult<ProgramRefreshLease>>
): Promise<ProgramRefreshLease> {
  const result = await promise;
  if (result.status === 'rejected') throw result.reason;
  return result.value;
}

function abandonObservedRefreshLease(
  promise: Promise<PromiseSettledResult<ProgramRefreshLease>>
): void {
  void promise.then((result) => {
    if (result.status === 'fulfilled') {
      void abandonProgramRefreshLease(result.value);
    }
  });
}

type TrackerScreenProps = {
  readonly ownerUserId: string;
  readonly programInstanceId: string;
  readonly onBack?: () => void;
};

interface FreshTrackerState {
  readonly detail: GenericProgramDetail;
  readonly definition: ProgramDefinition;
  readonly localStateVersion: number;
}

type SyncNotice = 'cached' | 'retry' | 'manual';

const MAX_RPE = 10;

function resolveProgramDefinition(detail: GenericProgramDetail): ProgramDefinition | null {
  try {
    return ProgramDefinitionSchema.parse(detail.customDefinition);
  } catch {
    return null;
  }
}

export function TrackerScreen({ ownerUserId, programInstanceId, onBack }: TrackerScreenProps) {
  const { t } = useTranslation();
  const trackerResourceKey = `${ownerUserId}\u0000${programInstanceId}`;
  const [detail, setDetail] = useState<GenericProgramDetail | null>(null);
  const [definition, setDefinition] = useState<ProgramDefinition | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncNotice, setSyncNotice] = useState<SyncNotice | null>(null);
  const [selectedWorkoutIndex, setSelectedWorkoutIndex] = useState(0);
  const detailRef = useRef<GenericProgramDetail | null>(null);
  const localStateVersionRef = useRef(0);
  const displayedResourceKeyRef = useRef(trackerResourceKey);

  function setDetailState(nextDetail: GenericProgramDetail | null): void {
    detailRef.current = nextDetail;
    setDetail(nextDetail);
  }

  useEffect(() => {
    let active = true;
    displayedResourceKeyRef.current = trackerResourceKey;
    localStateVersionRef.current = 0;
    setDetailState(null);
    setDefinition(null);
    setLoading(true);
    setSyncNotice(null);
    setSelectedWorkoutIndex(0);
    let session: AuthorizedSession;
    let detailLeasePromise: Promise<PromiseSettledResult<ProgramRefreshLease>>;
    let definitionLeaseForCleanup: ProgramRefreshLease | null = null;
    try {
      session = captureAuthorizedSession(ownerUserId);
      detailLeasePromise = observeRefreshLease(
        captureProgramRefreshLease(ownerUserId, `detail:${programInstanceId}`, session)
      );
    } catch {
      setLoading(false);
      return () => {
        active = false;
      };
    }

    function settleSupersededRefresh(): void {
      if (active) {
        setLoading(false);
      }
    }

    async function refreshTracker(hasCachedTracker: boolean): Promise<FreshTrackerState | null> {
      const refreshLocalStateVersion = localStateVersionRef.current;
      const detailLease = await readObservedRefreshLease(detailLeasePromise);
      let definitionLease: ProgramRefreshLease | null = null;
      return (async () => {
        try {
          await flushQueuedMutations(getAuthorizedSessionAccessToken(session));
        } catch {
          if (!active) {
            return null;
          }
          if (hasCachedTracker) {
            setSyncNotice('cached');
            setLoading(false);
            return null;
          }
        }

        const freshDetail = await fetchProgramDetail(programInstanceId, session);
        if (!active) {
          return null;
        }
        const inlineDefinition = resolveProgramDefinition(freshDetail);
        let freshDefinition: ProgramDefinition;
        if (inlineDefinition === null) {
          definitionLease = await captureProgramRefreshLease(
            ownerUserId,
            `definition:${freshDetail.programId}`,
            session
          );
          definitionLeaseForCleanup = definitionLease;
          if (!active) {
            await abandonProgramRefreshLease(definitionLease);
            return null;
          }
          freshDefinition = await fetchProgramDefinition(freshDetail.programId, session);
          if (!active) {
            return null;
          }
        } else {
          freshDefinition = inlineDefinition;
        }

        let definitionCommitted = true;
        if (definitionLease !== null) {
          if (!active) {
            return null;
          }
          definitionCommitted = await commitProgramDefinitionRefresh(
            definitionLease,
            freshDefinition
          );
        }

        if (!hasCachedTracker || localStateVersionRef.current === refreshLocalStateVersion) {
          if (!active) {
            return null;
          }
          const detailCommitted = await commitProgramDetailRefresh(detailLease, freshDetail);
          return withProgramRefreshCommitBarrier(
            ownerUserId,
            `definition:${freshDetail.programId}`,
            () =>
              withProgramRefreshCommitBarrier(
                ownerUserId,
                `detail:${programInstanceId}`,
                async () => {
                  if (!active || !isAuthorizedSessionCurrent(session)) {
                    return null;
                  }
                  const detailStillCurrent =
                    detailCommitted && isProgramRefreshLeaseCurrent(detailLease);
                  const winningDetail = detailStillCurrent
                    ? freshDetail
                    : await getProgramDetail(ownerUserId, programInstanceId);
                  if (winningDetail === null) {
                    return null;
                  }
                  const inlineWinningDefinition = resolveProgramDefinition(winningDetail);
                  const definitionStillCurrent =
                    definitionLease === null ||
                    (definitionCommitted && isProgramRefreshLeaseCurrent(definitionLease));
                  const winningDefinition =
                    inlineWinningDefinition ??
                    (definitionStillCurrent && winningDetail === freshDetail
                      ? freshDefinition
                      : await getProgramDefinition(ownerUserId, winningDetail.programId));
                  if (winningDefinition === null) {
                    return null;
                  }
                  return {
                    detail: winningDetail,
                    definition: winningDefinition,
                    localStateVersion: refreshLocalStateVersion,
                  };
                }
              )
          );
        }

        if (definitionLease !== null) {
          const settledDefinitionLease = definitionLease;
          const winningDefinition = await withProgramRefreshCommitBarrier(
            ownerUserId,
            `definition:${freshDetail.programId}`,
            async () =>
              definitionCommitted && isProgramRefreshLeaseCurrent(settledDefinitionLease)
                ? freshDefinition
                : await getProgramDefinition(ownerUserId, freshDetail.programId)
          );
          if (winningDefinition === null || !isAuthorizedSessionCurrent(session)) {
            return null;
          }
          freshDefinition = winningDefinition;
        }
        return {
          detail: freshDetail,
          definition: freshDefinition,
          localStateVersion: refreshLocalStateVersion,
        };
      })().finally(async () => {
        if (definitionLease !== null) {
          await abandonProgramRefreshLease(definitionLease);
        }
        await abandonProgramRefreshLease(detailLease);
      });
    }

    async function loadTracker(): Promise<void> {
      try {
        const cachedDetail = await getProgramDetail(ownerUserId, programInstanceId);
        const cachedDefinition = cachedDetail
          ? (resolveProgramDefinition(cachedDetail) ??
            (await getProgramDefinition(ownerUserId, cachedDetail.programId)))
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
          const freshTracker = await refreshTracker(hasCachedTracker);
          if (freshTracker === null) {
            settleSupersededRefresh();
            return;
          }

          if (!active) {
            return;
          }

          setDefinition(freshTracker.definition);
          setLoading(false);
          setSyncNotice(null);
          if (!hasCachedTracker) {
            setSelectedWorkoutIndex(0);
          }

          if (
            !hasCachedTracker ||
            localStateVersionRef.current === freshTracker.localStateVersion
          ) {
            setDetailState(freshTracker.detail);
          }
        } catch {
          if (!active) {
            return;
          }

          if (hasCachedTracker) {
            setSyncNotice('cached');
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
      abandonObservedRefreshLease(detailLeasePromise);
      if (definitionLeaseForCleanup !== null) {
        void abandonProgramRefreshLease(definitionLeaseForCleanup);
      }
    };
  }, [ownerUserId, programInstanceId, trackerResourceKey]);

  const stateMatchesResource = displayedResourceKeyRef.current === trackerResourceKey;
  const visibleDetail = stateMatchesResource ? detail : null;
  const visibleDefinition = stateMatchesResource ? definition : null;

  const rows = useMemo(() => {
    if (!visibleDetail || !visibleDefinition) {
      return [];
    }

    return computeGenericProgram(visibleDefinition, visibleDetail.config, visibleDetail.results);
  }, [visibleDefinition, visibleDetail]);

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
      await upsertProgramDetail(ownerUserId, {
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
      setSyncNotice((current) => (current === 'retry' ? null : current));
    } catch {
      setSyncNotice('manual');
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
      await upsertProgramDetail(ownerUserId, nextDetailWithUndo);
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
      setSyncNotice((current) => (current === 'retry' ? null : current));
    } catch {
      setSyncNotice('manual');
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
      await upsertProgramDetail(ownerUserId, nextDetail);
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
      setSyncNotice((current) => (current === 'retry' ? null : current));
    } catch {
      setSyncNotice('manual');
    }
  }

  const canUndo = (visibleDetail?.undoHistory.length ?? 0) > 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBlock}>
          <Text style={styles.body}>{t('tracker.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!visibleDetail || !visibleDefinition || !selectedRow) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBlock}>
          <Text style={styles.title}>{t('tracker.unavailable_title')}</Text>
          <Text style={styles.body}>{t('tracker.unavailable_body')}</Text>
          {onBack ? (
            <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
              <Text style={styles.backLabel}>{t('tracker.back')}</Text>
            </Pressable>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        {onBack ? (
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
            <Text style={styles.backLabel}>{t('tracker.back_to_programs')}</Text>
          </Pressable>
        ) : null}
        <View style={styles.toolbarRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('tracker.previous_accessibility')}
            disabled={selectedWorkoutIndex === 0}
            onPress={() => setSelectedWorkoutIndex((current) => Math.max(0, current - 1))}
            style={[styles.navButton, selectedWorkoutIndex === 0 ? styles.navButtonDisabled : null]}
          >
            <Text style={styles.navLabel}>{t('tracker.previous')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('tracker.undo_accessibility')}
            disabled={!canUndo}
            onPress={() => {
              void handleUndoLast();
            }}
            style={[styles.navButton, !canUndo ? styles.navButtonDisabled : null]}
          >
            <Text style={styles.navLabel}>{t('tracker.undo')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('tracker.next_accessibility')}
            disabled={selectedWorkoutIndex >= rows.length - 1}
            onPress={() =>
              setSelectedWorkoutIndex((current) => Math.min(rows.length - 1, current + 1))
            }
            style={[
              styles.navButton,
              selectedWorkoutIndex >= rows.length - 1 ? styles.navButtonDisabled : null,
            ]}
          >
            <Text style={styles.navLabel}>{t('tracker.next')}</Text>
          </Pressable>
        </View>
        <Text style={styles.eyebrow}>{visibleDetail.name}</Text>
        <Text style={styles.title}>{selectedRow.dayName}</Text>
        {syncNotice ? (
          <Text style={styles.syncNotice}>{t(`tracker.sync_${syncNotice}`)}</Text>
        ) : null}
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
