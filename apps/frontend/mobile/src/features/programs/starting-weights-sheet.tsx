import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ProgramDefinition } from '@gzclp/domain';

import {
  MAX_STARTING_WEIGHT,
  buildProgramConfig,
  startingWeightFields,
  validateStartingWeights,
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

/** Asks the lifter for today's working weights before a plan is created. */
export function StartingWeightsSheet({
  definition,
  busy,
  error,
  onClose,
  onConfirm,
}: StartingWeightsSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet
      visible={definition !== null}
      title={t('starting_weights.title', { name: definition?.name ?? '' })}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      {definition ? (
        <StartingWeightsForm
          key={definition.id}
          definition={definition}
          busy={busy}
          error={error}
          onConfirm={onConfirm}
        />
      ) : null}
    </Sheet>
  );
}

type FormProps = {
  readonly definition: ProgramDefinition;
  readonly busy: boolean;
  readonly error: string | null;
  readonly onConfirm: (config: Record<string, number | string>) => void;
};

function StartingWeightsForm({ definition, busy, error, onConfirm }: FormProps) {
  const { t } = useTranslation();
  const [fields] = useState(() => startingWeightFields(definition));
  const [values, setValues] = useState<Readonly<Record<string, string>>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, String(field.defaultValue)]))
  );
  const [issues, setIssues] = useState<Readonly<Record<string, StartingWeightIssue>>>({});

  function submit(): void {
    const validation = validateStartingWeights(fields, values);
    if (!validation.ok) {
      setIssues(validation.issues);
      return;
    }
    setIssues({});
    onConfirm(buildProgramConfig(definition, validation.weights));
  }

  return (
    <View style={styles.form}>
      <Text style={styles.intro}>{t('starting_weights.intro')}</Text>
      {fields.map((field) => {
        const issue = issues[field.key];
        return (
          <View key={field.key} style={styles.field}>
            <TextInput
              label={field.label}
              value={values[field.key] ?? ''}
              onChangeText={(text) => setValues((prev) => ({ ...prev, [field.key]: text }))}
              keyboardType="decimal-pad"
              selectTextOnFocus
              editable={!busy}
              {...(issue
                ? {
                    error: t(`starting_weights.errors.${issue}`, {
                      min: Math.max(field.min, 0),
                      max: MAX_STARTING_WEIGHT,
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
      {error ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      ) : null}
      <Button variant="primary" isLoading={busy} onPress={submit}>
        {t('starting_weights.confirm')}
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  intro: { ...type.body },
  field: { gap: 4 },
  hint: { ...type.meta, color: colors.textMuted },
  error: { ...type.body, color: colors.textError },
});
