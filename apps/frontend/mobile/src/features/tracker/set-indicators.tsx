import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { SetLogEntry } from '@gzclp/domain';

import { colors, radii } from '../../shell/design';

type SetIndicatorsProps = {
  readonly sets: number;
  readonly targetReps: number;
  readonly isAmrap: boolean;
  readonly logs: readonly SetLogEntry[] | undefined;
  readonly result: 'success' | 'fail' | undefined;
};

export function SetIndicators({ sets, targetReps, isAmrap, logs, result }: SetIndicatorsProps) {
  const { t } = useTranslation();

  if (sets <= 0) {
    return null;
  }

  return (
    <View
      accessibilityLabel={t('tracker.set_indicators.sets_aria', { count: sets })}
      style={styles.row}
    >
      {Array.from({ length: sets }, (_, index) => {
        const log = logs?.[index];
        const isLast = index === sets - 1;
        const pipStyle =
          log === undefined
            ? result === 'success'
              ? styles.pipSuccess
              : result === 'fail'
                ? styles.pipFail
                : index === (logs?.length ?? 0)
                  ? styles.pipNext
                  : styles.pipIdle
            : log.reps < targetReps
              ? styles.pipFail
              : styles.pipSuccess;

        return (
          <View
            key={index}
            accessibilityLabel={
              log === undefined
                ? undefined
                : t('tracker.set_indicators.set_result_aria', {
                    index: index + 1,
                    reps: log.reps,
                  })
            }
            style={[styles.pip, pipStyle]}
          >
            {isAmrap && isLast ? <Text style={styles.amrapMark}>+</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pip: {
    width: 44,
    height: 44,
    borderRadius: radii.base,
    borderWidth: 2,
  },
  pipIdle: {
    borderColor: colors.rule,
    backgroundColor: 'transparent',
    opacity: 0.4,
  },
  pipNext: {
    borderColor: colors.accent,
    backgroundColor: 'transparent',
  },
  pipSuccess: {
    borderColor: colors.ok,
    backgroundColor: colors.ok,
  },
  pipFail: {
    borderColor: colors.fail,
    backgroundColor: colors.fail,
  },
  amrapMark: {
    position: 'absolute',
    top: -8,
    right: -6,
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
});
