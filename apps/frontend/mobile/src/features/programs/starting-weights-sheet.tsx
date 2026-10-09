import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  MAX_PROGRAM_CONFIG_WEIGHT,
  buildProgramConfig,
  type ProgramDefinition,
} from '@gzclp/domain';

import {
  startingWeightFields,
  validateStartingWeights,
  type StartingWeightField,
  type StartingWeightIssue,
} from '../../lib/programs/starting-weights';
import { colors, type } from '../../shell/design';
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
  readonly values: Readonly<Record<string, string>>;
  readonly issues: Readonly<Record<string, StartingWeightIssue>>;
};

function freshDraft(definition: ProgramDefinition): Draft {
  const fields = startingWeightFields(definition);
  return {
    definitionId: definition.id,
    fields,
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
    onConfirm(buildProgramConfig(definition, validation.weights));
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
          <Text style={styles.intro}>{t('starting_weights.intro')}</Text>
          {current.fields.map((field) => {
            const issue = current.issues[field.key];
            return (
              <View key={field.key} style={styles.field}>
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
  intro: { ...type.body },
  field: { gap: 4 },
  hint: { ...type.meta, color: colors.textMuted },
  error: { ...type.body, color: colors.textError },
});
