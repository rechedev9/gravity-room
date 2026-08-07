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
import { colors, radii, spacing, typography } from '../../app/design';

type TrackerScreenProps = {
  readonly programInstanceId: string;
  readonly onBack: () => void;
};

const MAX_RPE = 10;

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
      setSyncNotice(null);
    } catch {
      setSyncNotice(t('tracker.notices.manual_retry'));
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
      setSyncNotice(null);
    } catch {
      setSyncNotice(t('tracker.notices.manual_retry'));
    }
  }

  const canUndo = (detail?.undoHistory.length ?? 0) > 0;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBlock}>
          <View style={styles.loadingMark} />
          <Text style={styles.body}>{t('tracker.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!detail || !definition || !selectedRow) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerBlock}>
          <Text style={styles.title}>{t('tracker.unavailable')}</Text>
          <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
            <Text style={styles.backLabel}>{t('tracker.back')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const completedSlots = selectedRow.slots.filter((slot) => slot.result !== undefined).length;
  const totalSlots = selectedRow.slots.length;
  const progressPercent = totalSlots === 0 ? 0 : Math.round((completedSlots / totalSlots) * 100);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityLabel={t('tracker.back_programs')}
            accessibilityRole="button"
            onPress={onBack}
            style={styles.iconButton}
          >
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.screenLabel}>{t('tracker.title')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('tracker.undo_accessibility')}
            disabled={!canUndo}
            onPress={() => {
              void handleUndoLast();
            }}
            style={[styles.iconButton, !canUndo ? styles.navButtonDisabled : null]}
          >
            <Text style={styles.undoIcon}>↶</Text>
          </Pressable>
        </View>

        <View style={styles.workoutHeader}>
          <Text style={styles.eyebrow}>{detail.name}</Text>
          <View style={styles.workoutTitleRow}>
            <Text style={styles.title}>{selectedRow.dayName}</Text>
            <View style={styles.workoutCountBadge}>
              <Text style={styles.workoutCountLabel}>
                {t('tracker.workout_count', {
                  current: selectedWorkoutIndex + 1,
                  total: rows.length,
                })}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressCopyRow}>
            <Text style={styles.progressLabel}>{t('tracker.progress')}</Text>
            <Text style={styles.progressValue}>
              {t('tracker.progress_value', {
                complete: completedSlots,
                total: totalSlots,
                percent: progressPercent,
              })}
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        {syncNotice ? (
          <View style={styles.syncNoticeCard}>
            <View style={styles.syncNoticeDot} />
            <Text style={styles.syncNotice}>{syncNotice}</Text>
          </View>
        ) : (
          <View style={styles.syncedRow}>
            <View style={styles.syncedDot} />
            <Text style={styles.syncedLabel}>{t('tracker.synced')}</Text>
          </View>
        )}

        <View style={styles.navigator}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('tracker.previous_accessibility')}
            disabled={selectedWorkoutIndex === 0}
            onPress={() => setSelectedWorkoutIndex((current) => Math.max(0, current - 1))}
            style={[styles.navButton, selectedWorkoutIndex === 0 ? styles.navButtonDisabled : null]}
          >
            <Text style={styles.navArrow}>‹</Text>
            <Text style={styles.navLabel}>{t('tracker.previous')}</Text>
          </Pressable>
          <View style={styles.navigatorCenter}>
            <Text style={styles.navigatorCenterLabel}>
              {t('tracker.exercise_count', { count: totalSlots })}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('tracker.next_accessibility')}
            disabled={selectedWorkoutIndex >= rows.length - 1}
            onPress={() =>
              setSelectedWorkoutIndex((current) => Math.min(rows.length - 1, current + 1))
            }
            style={[
              styles.navButton,
              styles.navButtonNext,
              selectedWorkoutIndex >= rows.length - 1 ? styles.navButtonDisabled : null,
            ]}
          >
            <Text style={styles.navLabel}>{t('tracker.next')}</Text>
            <Text style={styles.navArrow}>›</Text>
          </Pressable>
        </View>

        {selectedRow.slots.map((slot, slotIndex) => (
          <TrackerSlotCard
            key={slot.slotId}
            slot={slot}
            exerciseNumber={slotIndex + 1}
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
    backgroundColor: colors.canvas,
  },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: 10,
    paddingBottom: 32,
    gap: 12,
  },
  centerBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screenX,
    gap: 12,
  },
  loadingMark: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderTopColor: colors.accentPrimary,
  },
  topBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  backIcon: { color: colors.textPrimary, fontSize: 21, fontWeight: '600' },
  undoIcon: { color: colors.textPrimary, fontSize: 21, fontWeight: '600' },
  screenLabel: { color: colors.textPrimary, fontSize: 16, fontWeight: '800' },
  workoutHeader: { gap: 3, paddingTop: 4 },
  eyebrow: {
    color: colors.accentPrimary,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  workoutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.screenTitle,
    fontWeight: '800',
  },
  workoutCountBadge: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  workoutCountLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  body: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
  progressCard: {
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 9,
  },
  progressCopyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  progressValue: { color: colors.textPrimary, fontSize: 11, fontWeight: '800' },
  progressTrack: {
    height: 5,
    overflow: 'hidden',
    borderRadius: 3,
    backgroundColor: colors.cardElevated,
  },
  progressFill: { height: 5, borderRadius: 3, backgroundColor: colors.accentPrimary },
  syncNoticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderRadius: radii.control,
    backgroundColor: colors.card,
    padding: 11,
  },
  syncNoticeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accentWarning,
    marginTop: 5,
  },
  syncNotice: {
    flex: 1,
    color: colors.accentWarning,
    fontSize: 12,
    lineHeight: 18,
  },
  syncedRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 2 },
  syncedDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accentInfo },
  syncedLabel: { color: colors.accentInfo, fontSize: 11, fontWeight: '700' },
  navigator: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    paddingHorizontal: 4,
  },
  backButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  navButton: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
  },
  navButtonNext: {
    justifyContent: 'flex-end',
  },
  navButtonDisabled: {
    opacity: 0.32,
  },
  navLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  navArrow: { color: colors.textPrimary, fontSize: 20, fontWeight: '500' },
  navigatorCenter: { flex: 1.2, alignItems: 'center' },
  navigatorCenterLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
});
