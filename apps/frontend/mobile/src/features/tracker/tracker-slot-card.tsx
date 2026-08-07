import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { colors, radii, typography } from '../../app/design';

type TrackerSlot = {
  readonly slotId: string;
  readonly exerciseName: string;
  readonly tier: string;
  readonly weight: number;
  readonly sets: number;
  readonly reps: number;
  readonly result: 'success' | 'fail' | undefined;
  readonly isAmrap: boolean;
  readonly amrapReps: number | undefined;
  readonly rpe: number | undefined;
  readonly setLogs:
    | readonly {
        readonly reps: number;
        readonly weight?: number | undefined;
        readonly rpe?: number | undefined;
      }[]
    | undefined;
};

type TrackerSlotCardProps = {
  readonly slot: TrackerSlot;
  readonly exerciseNumber: number;
  readonly workoutIndex: number;
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
  exerciseNumber,
  workoutIndex,
  onMarkResult,
  onMetricChange,
  onClearMetric,
}: TrackerSlotCardProps) {
  const { t } = useTranslation();
  const showMetricEditors = slot.result === 'success';
  const setRows = Array.from({ length: slot.sets }, (_, index) => {
    const log = slot.setLogs?.[index];
    return {
      index,
      reps: log?.reps ?? slot.reps,
      weight: log?.weight ?? slot.weight,
      rpe: log?.rpe,
    };
  });

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.exerciseIndex}>
          <Text style={styles.exerciseIndexText}>{exerciseNumber}</Text>
        </View>
        <View style={styles.exerciseCopy}>
          <Text style={styles.cardTitle}>{slot.exerciseName}</Text>
          <View style={styles.prescriptionRow}>
            <Text style={styles.cardMeta}>{t('tracker.weight', { weight: slot.weight })}</Text>
            <View style={styles.metaDivider} />
            <Text style={styles.cardMeta}>
              {t('tracker.sets_reps', { sets: slot.sets, reps: slot.reps })}
            </Text>
          </View>
        </View>
        <View style={styles.tierBadge}>
          <Text style={styles.tierLabel}>{slot.tier}</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View
          style={[
            styles.statusDot,
            slot.result === 'success'
              ? styles.statusDotSuccess
              : slot.result === 'fail'
                ? styles.statusDotFail
                : styles.statusDotPending,
          ]}
        />
        <Text
          style={[
            styles.cardStatus,
            slot.result === 'success'
              ? styles.statusSuccess
              : slot.result === 'fail'
                ? styles.statusFail
                : null,
          ]}
        >
          {slot.result === 'success'
            ? t('tracker.status.success')
            : slot.result === 'fail'
              ? t('tracker.status.fail')
              : t('tracker.status.awaiting')}
        </Text>
      </View>

      <View style={styles.setTable}>
        <View style={styles.setHeaderRow}>
          <Text style={[styles.setHeader, styles.setNumberColumn]}>
            {t('tracker.set_table.set')}
          </Text>
          <Text style={styles.setHeader}>{t('tracker.set_table.weight')}</Text>
          <Text style={styles.setHeader}>{t('tracker.set_table.reps')}</Text>
          <Text style={[styles.setHeader, styles.resultColumn]}>
            {t('tracker.set_table.status')}
          </Text>
        </View>
        {setRows.map((setRow) => (
          <View key={setRow.index} style={styles.setRow}>
            <Text style={[styles.setValue, styles.setNumberColumn]}>{setRow.index + 1}</Text>
            <Text style={styles.setValue}>{setRow.weight}</Text>
            <Text style={styles.setValue}>{setRow.reps}</Text>
            <View style={styles.resultColumn}>
              <View
                style={[
                  styles.resultMarker,
                  slot.result === 'success'
                    ? styles.resultMarkerSuccess
                    : slot.result === 'fail'
                      ? styles.resultMarkerFail
                      : null,
                ]}
              />
            </View>
          </View>
        ))}
      </View>

      {showMetricEditors ? (
        <View style={styles.metricsBlock}>
          {slot.isAmrap ? (
            <MetricStepper
              label={t('tracker.metrics.amrap', { value: slot.amrapReps ?? '-' })}
              decreaseLabel={t('tracker.actions.decrease_amrap', { name: slot.exerciseName })}
              increaseLabel={t('tracker.actions.increase_amrap', { name: slot.exerciseName })}
              clearLabel={t('tracker.actions.clear_amrap', { name: slot.exerciseName })}
              hasValue={slot.amrapReps !== undefined}
              onDecrease={() => {
                onMetricChange(workoutIndex, slot.slotId, 'amrapReps', slot.amrapReps, -1);
              }}
              onIncrease={() => {
                onMetricChange(workoutIndex, slot.slotId, 'amrapReps', slot.amrapReps, 1);
              }}
              onClear={() => {
                onClearMetric(workoutIndex, slot.slotId, 'amrapReps');
              }}
            />
          ) : null}
          <MetricStepper
            label={t('tracker.metrics.rpe', { value: slot.rpe ?? '-' })}
            decreaseLabel={t('tracker.actions.decrease_rpe', { name: slot.exerciseName })}
            increaseLabel={t('tracker.actions.increase_rpe', { name: slot.exerciseName })}
            clearLabel={t('tracker.actions.clear_rpe', { name: slot.exerciseName })}
            hasValue={slot.rpe !== undefined}
            onDecrease={() => {
              onMetricChange(workoutIndex, slot.slotId, 'rpe', slot.rpe, -1);
            }}
            onIncrease={() => {
              onMetricChange(workoutIndex, slot.slotId, 'rpe', slot.rpe, 1);
            }}
            onClear={() => {
              onClearMetric(workoutIndex, slot.slotId, 'rpe');
            }}
          />
        </View>
      ) : null}

      <View style={styles.resultActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('tracker.actions.mark_success', { name: slot.exerciseName })}
          accessibilityState={{ selected: slot.result === 'success' }}
          onPress={() => {
            onMarkResult(workoutIndex, slot.slotId, 'success');
          }}
          style={({ pressed }) => [
            styles.resultButton,
            styles.successButton,
            slot.result === 'success' ? styles.successButtonSelected : null,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Text
            style={[
              styles.successIcon,
              slot.result === 'success' ? styles.successSelectedForeground : null,
            ]}
          >
            ✓
          </Text>
          <Text
            style={[
              styles.successLabel,
              slot.result === 'success' ? styles.successSelectedForeground : null,
            ]}
          >
            {t('tracker.result.success')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('tracker.actions.mark_fail', { name: slot.exerciseName })}
          accessibilityState={{ selected: slot.result === 'fail' }}
          onPress={() => {
            onMarkResult(workoutIndex, slot.slotId, 'fail');
          }}
          style={({ pressed }) => [
            styles.resultButton,
            styles.failButton,
            slot.result === 'fail' ? styles.failButtonSelected : null,
            pressed ? styles.buttonPressed : null,
          ]}
        >
          <Text
            style={[styles.failIcon, slot.result === 'fail' ? styles.failSelectedForeground : null]}
          >
            ×
          </Text>
          <Text
            style={[
              styles.failLabel,
              slot.result === 'fail' ? styles.failSelectedForeground : null,
            ]}
          >
            {t('tracker.result.fail')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

type MetricStepperProps = {
  readonly label: string;
  readonly decreaseLabel: string;
  readonly increaseLabel: string;
  readonly clearLabel: string;
  readonly hasValue: boolean;
  readonly onDecrease: () => void;
  readonly onIncrease: () => void;
  readonly onClear: () => void;
};

function MetricStepper({
  label,
  decreaseLabel,
  increaseLabel,
  clearLabel,
  hasValue,
  onDecrease,
  onIncrease,
  onClear,
}: MetricStepperProps) {
  const { t } = useTranslation();

  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricActions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={decreaseLabel}
          onPress={onDecrease}
          style={styles.metricButton}
        >
          <Text style={styles.metricButtonLabel}>−</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={increaseLabel}
          onPress={onIncrease}
          style={styles.metricButton}
        >
          <Text style={styles.metricButtonLabel}>+</Text>
        </Pressable>
        {hasValue ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={clearLabel}
            onPress={onClear}
            style={styles.metricClearButton}
          >
            <Text style={styles.metricClearLabel}>{t('tracker.actions.clear')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    padding: 15,
    paddingBottom: 12,
  },
  exerciseIndex: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: colors.accentPrimary,
  },
  exerciseIndexText: { color: colors.accentPrimary, fontSize: 13, fontWeight: '900' },
  exerciseCopy: { flex: 1, gap: 4 },
  cardTitle: { color: colors.textPrimary, fontSize: typography.cardTitle, fontWeight: '800' },
  prescriptionRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cardMeta: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  metaDivider: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.borderStrong },
  tierBadge: {
    borderRadius: radii.small,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  tierLabel: { color: colors.textSecondary, fontSize: 10, fontWeight: '800' },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusDotPending: { backgroundColor: colors.textMuted },
  statusDotSuccess: { backgroundColor: colors.accentSuccess },
  statusDotFail: { backgroundColor: colors.accentDanger },
  cardStatus: { color: colors.textMuted, fontSize: 12, fontWeight: '700' },
  statusSuccess: { color: colors.accentSuccess },
  statusFail: { color: colors.accentDanger },
  setTable: { paddingHorizontal: 15, paddingVertical: 8 },
  setHeaderRow: { flexDirection: 'row', alignItems: 'center', minHeight: 28 },
  setHeader: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  setNumberColumn: { flex: 0.65 },
  resultColumn: { flex: 0.55, alignItems: 'flex-end' },
  setRow: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
  },
  setValue: { flex: 1, color: colors.textPrimary, fontSize: 13, fontVariant: ['tabular-nums'] },
  resultMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  resultMarkerSuccess: { borderColor: colors.accentSuccess, backgroundColor: colors.accentSuccess },
  resultMarkerFail: { borderColor: colors.accentDanger, backgroundColor: colors.accentDangerMuted },
  metricsBlock: {
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    padding: 12,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  metricLabel: { flex: 1, color: colors.textSecondary, fontSize: 12, fontWeight: '700' },
  metricActions: { flexDirection: 'row', gap: 6 },
  metricButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.small,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
  },
  metricButtonLabel: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  metricClearButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.small,
    paddingHorizontal: 10,
  },
  metricClearLabel: { color: colors.accentDanger, fontSize: 11, fontWeight: '800' },
  resultActions: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    padding: 12,
  },
  resultButton: {
    flex: 1,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderRadius: radii.control,
    borderWidth: 1,
  },
  successButton: { borderColor: colors.accentPrimary, backgroundColor: colors.card },
  successButtonSelected: { backgroundColor: colors.accentPrimary },
  failButton: { borderColor: colors.accentDanger, backgroundColor: colors.card },
  failButtonSelected: { backgroundColor: colors.accentDanger },
  buttonPressed: { opacity: 0.72 },
  successIcon: { color: colors.accentPrimary, fontSize: 16, fontWeight: '900' },
  successLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: '900' },
  successSelectedForeground: { color: colors.textOnAccent },
  failIcon: { color: colors.accentDanger, fontSize: 18, fontWeight: '700' },
  failLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: '900' },
  failSelectedForeground: { color: colors.textOnAccent },
});
