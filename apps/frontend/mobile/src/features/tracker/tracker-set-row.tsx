import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SetLogEntrySchema, type SetLogEntry } from '@gzclp/domain';
import { TextInput } from '../../ui/text-input';
import { Button } from '../../ui/button';
import { colors, type } from '../../shell/design';

type Props = {
  readonly exerciseName: string;
  readonly index: number;
  readonly weight: number;
  readonly reps: number;
  readonly onConfirm: (entry: SetLogEntry) => Promise<void>;
};

/** Text remains local until explicitly confirmed; domain schemas validate the entry. */
export function TrackerSetRow({ exerciseName, index, weight, reps, onConfirm }: Props) {
  const { t } = useTranslation();
  const [editedWeight, setWeightText] = useState<string>();
  const [editedReps, setRepsText] = useState<string>();
  // Fresh prescriptions update untouched inputs; explicit edits belong to the user.
  const weightText = editedWeight ?? String(weight);
  const repsText = editedReps ?? String(reps);
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const parsed = SetLogEntrySchema.safeParse({
    weight: Number(weightText.replace(',', '.')),
    reps: Number(repsText),
  });
  const valid = weightText.trim() !== '' && repsText.trim() !== '' && parsed.success;
  return (
    <View style={styles.row}>
      <Text style={styles.index}>{index}</Text>
      <View style={styles.input}>
        <TextInput
          label={t('tracker.set_row.weight')}
          accessibilityLabel={t('tracker.set_row.weight_accessibility', {
            name: exerciseName,
            index,
          })}
          value={weightText}
          onChangeText={setWeightText}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
      </View>
      <View style={styles.input}>
        <TextInput
          label={t('tracker.set_row.reps')}
          accessibilityLabel={t('tracker.set_row.reps_accessibility', {
            name: exerciseName,
            index,
          })}
          value={repsText}
          onChangeText={setRepsText}
          keyboardType="number-pad"
          selectTextOnFocus
        />
      </View>
      <View style={styles.confirm}>
        <Button
          variant="primary"
          accessibilityLabel={t('tracker.actions.confirm_set', { name: exerciseName, index })}
          disabled={!valid}
          isLoading={saving}
          onPress={async () => {
            if (!valid || !parsed.success || savingRef.current) return;
            savingRef.current = true;
            setSaving(true);
            try {
              await onConfirm(parsed.data);
            } finally {
              savingRef.current = false;
              setSaving(false);
            }
          }}
        >
          ✓
        </Button>
      </View>
    </View>
  );
}

export function LoggedSetRow({
  index,
  entry,
  fallbackWeight,
  targetReps,
}: {
  readonly index: number;
  readonly entry: SetLogEntry;
  readonly fallbackWeight: number;
  /** Prescribed reps; a logged set below it is a miss, matching the domain's fail rule. */
  readonly targetReps?: number | undefined;
}) {
  const { t } = useTranslation();
  const missed = targetReps !== undefined && entry.reps < targetReps;
  const weight = entry.weight ?? fallbackWeight;
  return (
    <View
      style={styles.logged}
      accessibilityLabel={t(missed ? 'tracker.set_row.logged_miss' : 'tracker.set_row.logged', {
        index,
        reps: entry.reps,
        weight,
      })}
    >
      <Text style={styles.index}>{index}</Text>
      <Text style={styles.value}>{t('tracker.weight', { weight })}</Text>
      <Text style={styles.value}>{t('tracker.set_row.logged_reps', { reps: entry.reps })}</Text>
      <Text style={missed ? styles.miss : styles.check}>{missed ? '✗' : '✓'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  logged: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 32 },
  confirm: { width: 48 },
  index: { ...type.meta, minWidth: 20, alignSelf: 'center' },
  input: { flex: 1 },
  value: { ...type.body, fontSize: 14, flex: 1 },
  check: { ...type.title, fontSize: 18, color: colors.ok, minWidth: 44, textAlign: 'center' },
  miss: { ...type.title, fontSize: 18, color: colors.fail, minWidth: 44, textAlign: 'center' },
});
