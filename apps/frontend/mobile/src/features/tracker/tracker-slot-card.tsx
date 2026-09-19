import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { GenericSlotRow, SetLogEntry } from '@gzclp/domain';

import { colors, type } from '../../shell/design';
import { IconButton } from '../../ui/icon-button';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { LoggedSetRow, TrackerSetRow } from './tracker-set-row';
import { nextSetIndex, slotSupportsSetFlow } from './tracker-set-logging';

type TrackerSlotCardProps = {
  readonly slot: GenericSlotRow;
  readonly workoutIndex: number;
  readonly variant?: 'hero' | 'queue';
  readonly draftLogs: readonly SetLogEntry[] | undefined;
  readonly onConfirmSet: (
    workoutIndex: number,
    slotId: string,
    entry: SetLogEntry
  ) => Promise<void>;
  readonly onUndoSet: (workoutIndex: number, slotId: string) => void;
  readonly onMarkResult: (workoutIndex: number, slotId: string, result: 'success' | 'fail') => void;
  readonly onMetricChange: (
    workoutIndex: number,
    slotId: string,
    metric: 'amrapReps' | 'rpe',
    currentValue: number | undefined,
    direction: -1 | 1
  ) => void;
  readonly onClearMetric: (
    workoutIndex: number,
    slotId: string,
    metric: 'amrapReps' | 'rpe'
  ) => void;
};

export function TrackerSlotCard({
  slot,
  workoutIndex,
  variant = 'queue',
  draftLogs,
  onConfirmSet,
  onMarkResult,
  onUndoSet,
  onMetricChange,
  onClearMetric,
}: TrackerSlotCardProps) {
  const { t } = useTranslation();
  const [showLogs, setShowLogs] = useState(false);
  const showMetricEditors = slot.result === 'success';
  const isHero = variant === 'hero';
  const usesSetFlow = slotSupportsSetFlow(slot);
  const displayLogs = draftLogs ?? slot.setLogs;
  const setNumber = nextSetIndex(displayLogs) + 1;
  const canConfirmSet = usesSetFlow && slot.result === undefined;
  const statusLabel =
    slot.result === 'success'
      ? t('tracker.status.success')
      : slot.result === 'fail'
        ? t('tracker.status.fail')
        : t('tracker.status.awaiting');

  return (
    <Card focal={isHero}>
      <View style={styles.headerRow}>
        <View style={styles.exerciseIcon}>
          <Ionicons
            name={slot.result === 'success' ? 'checkmark' : 'barbell-outline'}
            size={22}
            color={slot.result === 'success' ? colors.ok : colors.textSecondary}
          />
        </View>
        <View style={styles.heading}>
          <Text style={styles.cardTitle}>{slot.exerciseName}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.scheme}>
              {t('tracker.sets_reps', { sets: slot.sets, reps: slot.reps })}
            </Text>
            <Text style={styles.metaDivider}>·</Text>
            <Text style={styles.cardMeta}>{t('tracker.weight', { weight: slot.weight })}</Text>
          </View>
        </View>
        <Text
          style={[
            styles.status,
            slot.result === undefined && styles.statusAwaiting,
            slot.result === 'fail' && styles.statusFail,
          ]}
        >
          {statusLabel}
        </Text>
      </View>
      {canConfirmSet && (draftLogs?.length ?? 0) > 0 ? (
        <View style={styles.undoSet}>
          <IconButton
            name="arrow-undo-outline"
            label={t('tracker.undo_set', { name: slot.exerciseName })}
            onPress={() => onUndoSet(workoutIndex, slot.slotId)}
          />
        </View>
      ) : null}
      {slot.result !== undefined ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('tracker.toggle_sets', { name: slot.exerciseName })}
          accessibilityState={{ expanded: showLogs }}
          onPress={() => setShowLogs((value) => !value)}
          style={styles.logsToggle}
        >
          <Text style={styles.scheme}>
            {t('tracker.sets_recorded', { count: displayLogs?.length ?? 0 })}
          </Text>
          <Ionicons
            name={showLogs ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.textMuted}
          />
        </Pressable>
      ) : null}
      {usesSetFlow ? (
        <View style={{ gap: 8 }}>
          {(slot.result === undefined || showLogs) &&
            displayLogs?.map((entry, index) => (
              <LoggedSetRow
                key={index}
                index={index + 1}
                entry={entry}
                fallbackWeight={slot.weight}
                targetReps={slot.reps}
              />
            ))}
          {canConfirmSet ? (
            <TrackerSetRow
              key={`${workoutIndex}:${slot.slotId}:${setNumber}`}
              exerciseName={slot.exerciseName}
              index={setNumber}
              weight={slot.weight}
              reps={slot.reps}
              onConfirm={(entry) => onConfirmSet(workoutIndex, slot.slotId, entry)}
            />
          ) : null}
        </View>
      ) : null}
      {showMetricEditors && showLogs ? (
        <View style={styles.metricsBlock}>
          {slot.isAmrap ? (
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>
                {t('tracker.metrics.amrap', { value: slot.amrapReps ?? '-' })}
              </Text>
              <View style={styles.metricActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('tracker.actions.decrease_amrap', {
                    name: slot.exerciseName,
                  })}
                  onPress={() => {
                    onMetricChange(workoutIndex, slot.slotId, 'amrapReps', slot.amrapReps, -1);
                  }}
                  style={styles.metricButton}
                >
                  <Text style={styles.metricButtonLabel}>-</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('tracker.actions.increase_amrap', {
                    name: slot.exerciseName,
                  })}
                  onPress={() => {
                    onMetricChange(workoutIndex, slot.slotId, 'amrapReps', slot.amrapReps, 1);
                  }}
                  style={styles.metricButton}
                >
                  <Text style={styles.metricButtonLabel}>+</Text>
                </Pressable>
                {slot.amrapReps !== undefined ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('tracker.actions.clear_amrap', {
                      name: slot.exerciseName,
                    })}
                    onPress={() => {
                      onClearMetric(workoutIndex, slot.slotId, 'amrapReps');
                    }}
                    style={styles.metricClearButton}
                  >
                    <Text style={styles.metricClearLabel}>{t('tracker.actions.clear')}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>
              {t('tracker.metrics.rpe', { value: slot.rpe ?? '-' })}
            </Text>
            <View style={styles.metricActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('tracker.actions.decrease_rpe', {
                  name: slot.exerciseName,
                })}
                onPress={() => {
                  onMetricChange(workoutIndex, slot.slotId, 'rpe', slot.rpe, -1);
                }}
                style={styles.metricButton}
              >
                <Text style={styles.metricButtonLabel}>-</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('tracker.actions.increase_rpe', {
                  name: slot.exerciseName,
                })}
                onPress={() => {
                  onMetricChange(workoutIndex, slot.slotId, 'rpe', slot.rpe, 1);
                }}
                style={styles.metricButton}
              >
                <Text style={styles.metricButtonLabel}>+</Text>
              </Pressable>
              {slot.rpe !== undefined ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('tracker.actions.clear_rpe', {
                    name: slot.exerciseName,
                  })}
                  onPress={() => {
                    onClearMetric(workoutIndex, slot.slotId, 'rpe');
                  }}
                  style={styles.metricClearButton}
                >
                  <Text style={styles.metricClearLabel}>{t('tracker.actions.clear')}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
      {slot.result === undefined && (displayLogs?.length ?? 0) === 0 ? (
        <View style={isHero ? styles.heroActions : styles.queueActions}>
          <View style={isHero ? null : styles.actionFlex}>
            {!usesSetFlow ? (
              <Button
                variant="primary"
                accessibilityLabel={t('tracker.actions.mark_success', { name: slot.exerciseName })}
                accessibilityState={{ selected: slot.result === 'success' }}
                onPress={() => {
                  onMarkResult(workoutIndex, slot.slotId, 'success');
                }}
              >
                {t('tracker.result.success')}
              </Button>
            ) : null}
          </View>
          <View style={isHero ? null : styles.actionFlex}>
            <Button
              variant="ghost"
              accessibilityLabel={t('tracker.actions.mark_fail', { name: slot.exerciseName })}
              accessibilityState={{ selected: slot.result === 'fail' }}
              onPress={() => {
                onMarkResult(workoutIndex, slot.slotId, 'fail');
              }}
            >
              {t('tracker.result.fail')}
            </Button>
          </View>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  undoSet: { alignItems: 'flex-end' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  status: { ...type.kicker, color: colors.ok, fontSize: 8, maxWidth: 70, textAlign: 'right' },
  heading: { flex: 1, gap: 4 },
  exerciseIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  metaDivider: { color: colors.textMuted },
  logsToggle: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusAwaiting: {
    color: colors.accent,
  },
  statusFail: {
    color: colors.fail,
  },
  cardTitle: {
    ...type.title,
    fontSize: 18,
  },
  cardMeta: {
    ...type.meta,
    color: colors.textSecondary,
    fontSize: 12,
  },
  scheme: {
    ...type.meta,
    color: colors.textMuted,
  },
  metricsBlock: {
    marginTop: 4,
    gap: 8,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  metricLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  metricActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.rule,
    paddingHorizontal: 14,
  },
  metricButtonLabel: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  metricClearButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 14,
  },
  metricClearLabel: {
    ...type.button,
    color: colors.textMuted,
  },
  heroActions: {
    marginTop: 8,
    gap: 8,
  },
  queueActions: {
    marginTop: 4,
    flexDirection: 'row',
    gap: 8,
  },
  actionFlex: {
    flex: 1,
  },
});
