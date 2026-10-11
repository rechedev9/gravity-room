import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ExerciseEntry, MuscleGroupEntry } from '@gzclp/domain';
import { type } from '../../shell/design';
import { colors } from '@gzclp/design-tokens';
import { Sheet } from '../../ui/sheet';
import { attributeLabel } from './exercise-labels';

type Props = {
  readonly exercise: ExerciseEntry | null;
  readonly muscleGroups: readonly MuscleGroupEntry[];
  readonly onClose: () => void;
};

export function ExerciseDetailSheet({ exercise, muscleGroups, onClose }: Props) {
  const { t } = useTranslation();
  const muscleName = (id: string) =>
    attributeLabel(t, 'muscle', id, muscleGroups.find((group) => group.id === id)?.name);
  const rows: readonly { readonly label: string; readonly value: string | null }[] = exercise
    ? [
        { label: t('exercises.detail.muscle'), value: muscleName(exercise.muscleGroupId) },
        {
          label: t('exercises.detail.equipment'),
          value: exercise.equipment ? attributeLabel(t, 'equipment', exercise.equipment) : null,
        },
        {
          label: t('exercises.detail.level'),
          value: exercise.level ? attributeLabel(t, 'level', exercise.level) : null,
        },
        {
          label: t('exercises.detail.mechanic'),
          value: exercise.mechanic ? attributeLabel(t, 'mechanic', exercise.mechanic) : null,
        },
        {
          label: t('exercises.detail.force'),
          value: exercise.force ? attributeLabel(t, 'force', exercise.force) : null,
        },
        {
          label: t('exercises.detail.category'),
          value: exercise.category ? attributeLabel(t, 'category', exercise.category) : null,
        },
      ]
    : [];
  return (
    <Sheet visible={exercise !== null} title={exercise?.name ?? ''} onClose={onClose}>
      {exercise ? (
        <>
          {exercise.isPreset ? null : (
            <Text style={styles.custom}>{t('exercises.detail.custom')}</Text>
          )}
          <View style={styles.table}>
            {rows.map((row, index) => (
              <View
                key={row.label}
                style={[styles.row, index === rows.length - 1 ? styles.lastRow : null]}
              >
                <Text style={styles.label}>{row.label}</Text>
                <Text style={row.value ? styles.value : styles.empty}>
                  {row.value ?? t('exercises.detail.unspecified')}
                </Text>
              </View>
            ))}
          </View>
          {exercise.secondaryMuscles && exercise.secondaryMuscles.length > 0 ? (
            <View style={styles.also}>
              <Text style={styles.label}>{t('exercises.detail.also_works')}</Text>
              <View style={styles.tags}>
                {Array.from(new Set(exercise.secondaryMuscles)).map((id) => (
                  <View key={id} style={styles.tag}>
                    <Text style={styles.tagText}>{muscleName(id)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  custom: { ...type.kicker, color: colors.accent },
  table: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.rule,
    backgroundColor: colors.canvas,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    minHeight: 48,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  lastRow: { borderBottomWidth: 0 },
  label: { ...type.meta },
  value: { ...type.body, color: colors.textPrimary, flexShrink: 1, textAlign: 'right' },
  empty: { ...type.body, color: colors.textMuted, flexShrink: 1, textAlign: 'right' },
  also: { gap: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 8 },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.surface2,
  },
  tagText: { ...type.body, fontSize: 13, lineHeight: 18, color: colors.textPrimary },
});
