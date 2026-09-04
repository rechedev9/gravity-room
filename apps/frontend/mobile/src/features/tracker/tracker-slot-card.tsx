import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { GenericSlotRow, SetLogEntry } from '@gzclp/domain';

import { colors, type } from '../../app/design';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { SetIndicators } from './set-indicators';
import { nextSetIndex, slotSupportsSetFlow } from './tracker-set-logging';

type TrackerSlotCardProps = {
  readonly slot: GenericSlotRow;
  readonly workoutIndex: number;
  readonly variant?: 'hero' | 'queue';
  readonly draftLogs: readonly SetLogEntry[] | undefined;
  readonly onConfirmSet: (workoutIndex: number, slotId: string) => void;
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
  onMetricChange,
  onClearMetric,
}: TrackerSlotCardProps) {
  const { t } = useTranslation();
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
        <Text
          style={[
            styles.status,
            slot.result === undefined ? styles.statusAwaiting : null,
            slot.result === 'fail' ? styles.statusFail : null,
          ]}
        >
          {statusLabel}
        </Text>
      </View>
      <Text style={isHero ? styles.heroName : styles.cardTitle}>{slot.exerciseName}</Text>
      <Text style={isHero ? styles.heroWeight : styles.cardMeta}>
        {t('tracker.weight', { weight: slot.weight })}
      </Text>
      <Text style={styles.scheme}>
        {t('tracker.sets_reps', { sets: slot.sets, reps: slot.reps })}
      </Text>
      {usesSetFlow ? (
        <SetIndicators
          sets={slot.sets}
          targetReps={slot.reps}
          isAmrap={slot.isAmrap}
          logs={displayLogs}
          result={slot.result}
        />
      ) : null}
      {showMetricEditors ? (
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
      {slot.result === undefined ? (
        <View style={isHero ? styles.heroActions : styles.queueActions}>
          <View style={isHero ? null : styles.actionFlex}>
            {canConfirmSet ? (
              <Button
                variant="primary"
                accessibilityLabel={t('tracker.actions.confirm_set', {
                  name: slot.exerciseName,
                  index: setNumber,
                })}
                onPress={() => {
                  onConfirmSet(workoutIndex, slot.slotId);
                }}
              >
                {t('tracker.confirm_set', { index: setNumber })}
              </Button>
            ) : (
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
            )}
          </View>
          <View style={isHero ? null : styles.actionFlex}>
            <Button
              variant="danger"
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  status: {
    ...type.kicker,
    color: colors.ok,
  },
  statusAwaiting: {
    color: colors.accent,
  },
  statusFail: {
    color: colors.fail,
  },
  heroName: {
    ...type.display,
    fontSize: 40,
    lineHeight: 42,
  },
  cardTitle: {
    ...type.title,
  },
  heroWeight: {
    ...type.displayData,
  },
  cardMeta: {
    ...type.meta,
    color: colors.textSecondary,
    fontSize: 14,
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
    gap: 8,
  },
  metricLabel: {
    color: colors.textPrimary,
    fontSize: 14,
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
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
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
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.errorLine,
    paddingHorizontal: 14,
  },
  metricClearLabel: {
    ...type.button,
    color: colors.fail,
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
