import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { type } from '../shell/design';
import { Button } from './button';

type Props = {
  readonly label: string;
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly disabled?: boolean;
  readonly onChange: (value: number) => void;
};

export function Stepper({
  label,
  value,
  min = 0,
  max = Infinity,
  step = 1,
  disabled = false,
  onChange,
}: Props) {
  const { t } = useTranslation();
  const valid = Number.isFinite(value) && Number.isFinite(step) && step > 0 && min <= max;
  const canDecrease = !disabled && valid && value - step >= min;
  const canIncrease = !disabled && valid && value + step <= max;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.controls}>
        <Button
          accessibilityLabel={t('ui.decrease', { label })}
          disabled={!canDecrease}
          onPress={() => {
            if (canDecrease) onChange(value - step);
          }}
        >
          −
        </Button>
        <Text style={styles.value}>{value}</Text>
        <Button
          accessibilityLabel={t('ui.increase', { label })}
          disabled={!canIncrease}
          onPress={() => {
            if (canIncrease) onChange(value + step);
          }}
        >
          +
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { ...type.meta },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  value: { ...type.title, minWidth: 44, textAlign: 'center' },
});
