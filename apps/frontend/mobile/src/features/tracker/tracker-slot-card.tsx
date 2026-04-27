import { Pressable, StyleSheet, Text, View } from 'react-native';

type TrackerSlot = {
  readonly slotId: string;
  readonly exerciseName: string;
  readonly weight: number;
  readonly sets: number;
  readonly reps: number;
  readonly result: 'success' | 'fail' | undefined;
  readonly isAmrap: boolean;
  readonly amrapReps: number | undefined;
  readonly rpe: number | undefined;
};

type TrackerSlotCardProps = {
  readonly slot: TrackerSlot;
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
  workoutIndex,
  onMarkResult,
  onMetricChange,
  onClearMetric,
}: TrackerSlotCardProps) {
  const showMetricEditors = slot.result === 'success';

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{slot.exerciseName}</Text>
      <Text style={styles.cardMeta}>{slot.weight} kg</Text>
      <Text style={styles.cardMeta}>
        {slot.sets} x {slot.reps}
      </Text>
      <Text style={styles.cardStatus}>
        {slot.result === 'success'
          ? 'Logged success'
          : slot.result === 'fail'
            ? 'Logged fail'
            : 'Awaiting result'}
      </Text>
      {showMetricEditors ? (
        <View style={styles.metricsBlock}>
          {slot.isAmrap ? (
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>AMRAP reps: {slot.amrapReps ?? '-'}</Text>
              <View style={styles.metricActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Decrease ${slot.exerciseName} AMRAP reps`}
                  onPress={() => {
                    onMetricChange(workoutIndex, slot.slotId, 'amrapReps', slot.amrapReps, -1);
                  }}
                  style={styles.metricButton}
                >
                  <Text style={styles.metricButtonLabel}>-</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Increase ${slot.exerciseName} AMRAP reps`}
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
                    accessibilityLabel={`Clear ${slot.exerciseName} AMRAP reps`}
                    onPress={() => {
                      onClearMetric(workoutIndex, slot.slotId, 'amrapReps');
                    }}
                    style={styles.metricClearButton}
                  >
                    <Text style={styles.metricClearLabel}>Clear</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}

          <View style={styles.metricRow}>
            <Text style={styles.metricLabel}>RPE: {slot.rpe ?? '-'}</Text>
            <View style={styles.metricActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Decrease ${slot.exerciseName} RPE`}
                onPress={() => {
                  onMetricChange(workoutIndex, slot.slotId, 'rpe', slot.rpe, -1);
                }}
                style={styles.metricButton}
              >
                <Text style={styles.metricButtonLabel}>-</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Increase ${slot.exerciseName} RPE`}
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
                  accessibilityLabel={`Clear ${slot.exerciseName} RPE`}
                  onPress={() => {
                    onClearMetric(workoutIndex, slot.slotId, 'rpe');
                  }}
                  style={styles.metricClearButton}
                >
                  <Text style={styles.metricClearLabel}>Clear</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mark ${slot.exerciseName} success`}
        onPress={() => {
          onMarkResult(workoutIndex, slot.slotId, 'success');
        }}
        style={styles.successButton}
      >
        <Text style={styles.successLabel}>Success</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mark ${slot.exerciseName} fail`}
        onPress={() => {
          onMarkResult(workoutIndex, slot.slotId, 'fail');
        }}
        style={styles.failButton}
      >
        <Text style={styles.failLabel}>Fail</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    backgroundColor: '#111827',
    padding: 18,
    gap: 8,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '700',
  },
  cardMeta: {
    color: '#CBD5E1',
    fontSize: 15,
  },
  cardStatus: {
    color: '#A7F3D0',
    fontSize: 15,
    fontWeight: '600',
  },
  metricsBlock: {
    marginTop: 4,
    gap: 8,
  },
  metricRow: {
    gap: 8,
  },
  metricLabel: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  metricActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricButton: {
    minWidth: 42,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#475569',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  metricButtonLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  metricClearButton: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#7C2D12',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  metricClearLabel: {
    color: '#FDBA74',
    fontSize: 13,
    fontWeight: '700',
  },
  successButton: {
    marginTop: 4,
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#22C55E',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  successLabel: {
    color: '#04130A',
    fontSize: 15,
    fontWeight: '700',
  },
  failButton: {
    marginTop: 4,
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#F97316',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  failLabel: {
    color: '#220A02',
    fontSize: 15,
    fontWeight: '700',
  },
});
