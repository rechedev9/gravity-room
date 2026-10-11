import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  MAX_PROGRAM_CONFIG_WEIGHT,
  buildProgramConfig,
  type ProgramDefinition,
} from '@gzclp/domain';

import {
  startingChoiceFields,
  startingWeightFields,
  validateStartingWeights,
  type StartingChoiceField,
  type StartingWeightField,
  type StartingWeightIssue,
} from '../../lib/programs/starting-weights';
import { type } from '../../shell/design';
import { colors, radii } from '@gzclp/design-tokens';
import { Button } from '../../ui/button';
import { Sheet } from '../../ui/sheet';
import { TextInput } from '../../ui/text-input';

export type StartingWeightsSheetProps = {
  readonly definition: ProgramDefinition | null;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onClose: () => void;
  readonly onConfirm: (config: Record<string, number | string>) => void;
};

type Draft = {
  readonly definitionId: string;
  readonly fields: readonly StartingWeightField[];
  readonly choiceFields: readonly StartingChoiceField[];
  readonly choices: Readonly<Record<string, string>>;
  readonly values: Readonly<Record<string, string>>;
  readonly issues: Readonly<Record<string, StartingWeightIssue>>;
};

function freshDraft(definition: ProgramDefinition): Draft {
  const fields = startingWeightFields(definition);
  const choiceFields = startingChoiceFields(definition);
  return {
    definitionId: definition.id,
    fields,
    choiceFields,
    choices: Object.fromEntries(choiceFields.map((field) => [field.key, field.defaultValue])),
    values: Object.fromEntries(fields.map((field) => [field.key, String(field.defaultValue)])),
    issues: {},
  };
}

/** Asks the lifter for today's working weights before a plan is created. */
export function StartingWeightsSheet({
  definition,
  busy,
  error,
  onClose,
  onConfirm,
}: StartingWeightsSheetProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<Draft | null>(null);
  // Each program opens with its own fresh form; adjusting state while rendering avoids a stale frame.
  if (definition && draft?.definitionId !== definition.id) {
    setDraft(freshDraft(definition));
  }
  const current = definition && draft?.definitionId === definition.id ? draft : null;

  function submit(): void {
    if (!definition || !current) return;
    const validation = validateStartingWeights(current.fields, current.values);
    if (!validation.ok) {
      setDraft({ ...current, issues: validation.issues });
      return;
    }
    setDraft({ ...current, issues: {} });
    onConfirm({ ...buildProgramConfig(definition, validation.weights), ...current.choices });
  }

  return (
    <Sheet
      visible={definition !== null}
      title={t('starting_weights.title', { name: definition?.name ?? '' })}
      onClose={() => {
        if (!busy) onClose();
      }}
      footer={
        <>
          {error ? (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <Button variant="primary" isLoading={busy} onPress={submit}>
            {t('starting_weights.confirm')}
          </Button>
        </>
      }
    >
      {current ? (
        <View style={styles.form}>
          <Text style={styles.intro}>
            {definition?.configDescription ?? t('starting_weights.intro')}
          </Text>
          {definition?.configFields.map((configField, position) => {
            const previous = definition.configFields[position - 1];
            const heading =
              configField.group !== undefined && configField.group !== previous?.group
                ? configField.group
                : null;
            const choiceField = current.choiceFields.find(
              (candidate) => candidate.key === configField.key
            );
            const field = current.fields.find((candidate) => candidate.key === configField.key);
            const issue = field ? current.issues[field.key] : undefined;
            const headingNode =
              heading !== null ? (
                <View style={styles.group}>
                  <Text style={styles.groupTitle}>{heading}</Text>
                  {field?.groupHint !== undefined ? (
                    <Text style={styles.hint}>{field.groupHint}</Text>
                  ) : null}
                </View>
              ) : null;
            if (choiceField) {
              const selected = current.choices[choiceField.key];
              return (
                <View key={choiceField.key} style={styles.field}>
                  {headingNode}
                  <Text style={styles.choiceLabel}>{choiceField.label}</Text>
                  <View accessibilityRole="radiogroup" style={styles.choices}>
                    {choiceField.options.map((option) => (
                      <Pressable
                        key={option.value}
                        accessibilityRole="radio"
                        accessibilityLabel={option.label}
                        accessibilityState={{
                          checked: option.value === selected,
                          disabled: busy,
                        }}
                        disabled={busy}
                        onPress={() =>
                          setDraft({
                            ...current,
                            choices: { ...current.choices, [choiceField.key]: option.value },
                          })
                        }
                        style={[styles.choice, option.value === selected && styles.choiceSelected]}
                      >
                        <Text
                          style={[
                            styles.choiceText,
                            option.value === selected && styles.choiceTextSelected,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              );
            }
            if (!field) return null;
            return (
              <View key={field.key} style={styles.field}>
                {headingNode}
                <TextInput
                  label={field.label}
                  value={current.values[field.key] ?? ''}
                  onChangeText={(text) =>
                    setDraft({ ...current, values: { ...current.values, [field.key]: text } })
                  }
                  keyboardType="decimal-pad"
                  selectTextOnFocus
                  editable={!busy}
                  {...(issue
                    ? {
                        error: t(`starting_weights.errors.${issue}`, {
                          min: Math.max(field.min, 0),
                          max: MAX_PROGRAM_CONFIG_WEIGHT,
                        }),
                      }
                    : {})}
                />
                <Text style={styles.hint}>
                  {field.hint ??
                    t('starting_weights.hint', { min: Math.max(field.min, 0), step: field.step })}
                </Text>
              </View>
            );
          })}
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  group: { gap: 2, paddingTop: 8 },
  groupTitle: { ...type.kicker, color: colors.accent },
  choiceLabel: { ...type.meta },
  choices: { gap: 6 },
  choice: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.base,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  choiceSelected: { borderColor: colors.accent, backgroundColor: colors.surface2 },
  choiceText: { ...type.body, fontSize: 14, lineHeight: 20, color: colors.textSecondary },
  choiceTextSelected: { color: colors.textPrimary },
  intro: { ...type.body },
  field: { gap: 4 },
  hint: { ...type.meta, color: colors.textMuted },
  error: { ...type.body, color: colors.textError },
});
