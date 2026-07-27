import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { ProgramDefinition } from '@gzclp/domain';
import {
  validateProgramConfig,
  type ProgramConfig,
  type ProgramConfigIssue,
} from '@gzclp/domain/program-config';

import { startPresetProgram } from '../../lib/programs/program-use-cases';
import {
  buildDefaultProgramConfig,
  fetchCatalogDefinition,
} from '../../lib/programs/program-service';
import {
  getProgramDefinition,
  upsertProgramDefinition,
} from '../../lib/tracker/program-detail-repository';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';
import { Screen } from '../../ui/screen';
import { colors, radii, spacing } from '../../ui/tokens';

type PresetState =
  | { readonly status: 'loading' }
  | {
      readonly status: 'ready';
      readonly definition: ProgramDefinition;
      readonly offline: boolean;
    }
  | { readonly status: 'error' };

interface PresetSetupScreenProps {
  readonly ownerUserId: string;
  readonly programId: string;
  readonly onBack: () => void;
  readonly onCreated: (programInstanceId: string) => void;
}

function toInputValues(config: ProgramConfig): Record<string, string> {
  return Object.fromEntries(Object.entries(config).map(([key, value]) => [key, String(value)]));
}

function buildConfigCandidate(
  definition: ProgramDefinition,
  values: Readonly<Record<string, string>>
): Record<string, number | string> {
  const config: Record<string, number | string> = {};

  for (const field of definition.configFields) {
    const rawValue = values[field.key];
    if (rawValue === undefined || rawValue.trim().length === 0) {
      continue;
    }

    if (field.type === 'select') {
      config[field.key] = rawValue;
      continue;
    }

    const numericValue = Number(rawValue);
    config[field.key] = Number.isFinite(numericValue) ? numericValue : rawValue;
  }

  return config;
}

function findFieldIssue(
  issues: readonly ProgramConfigIssue[],
  fieldKey: string
): ProgramConfigIssue | null {
  return issues.find((issue) => issue.fieldKey === fieldKey) ?? null;
}

function collectRuleTypes(definition: ProgramDefinition): readonly string[] {
  const rules = new Set<string>();
  for (const day of definition.days) {
    for (const slot of day.slots) {
      rules.add(slot.onSuccess.type);
      rules.add(slot.onMidStageFail.type);
      rules.add(slot.onFinalStageFail.type);
      if (slot.onFinalStageSuccess) rules.add(slot.onFinalStageSuccess.type);
      if (slot.onUndefined) rules.add(slot.onUndefined.type);
    }
  }
  return [...rules].sort();
}

export function PresetSetupScreen({
  onBack,
  onCreated,
  ownerUserId,
  programId,
}: PresetSetupScreenProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<PresetState>({ status: 'loading' });
  const [values, setValues] = useState<Record<string, string>>({});
  const [issues, setIssues] = useState<readonly ProgramConfigIssue[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadPreset(): Promise<void> {
      let cachedDefinition: ProgramDefinition | null = null;
      try {
        cachedDefinition = await getProgramDefinition(ownerUserId, programId);
        if (cachedDefinition && active) {
          setState({ status: 'ready', definition: cachedDefinition, offline: false });
          setValues(toInputValues(buildDefaultProgramConfig(cachedDefinition)));
        }
      } catch {
        cachedDefinition = null;
      }

      try {
        const definition = await fetchCatalogDefinition(programId);
        await upsertProgramDefinition(ownerUserId, definition);
        if (active) {
          setState({ status: 'ready', definition, offline: false });
          setValues(toInputValues(buildDefaultProgramConfig(definition)));
        }
      } catch {
        if (active && cachedDefinition === null) {
          setState({ status: 'error' });
        } else if (active && cachedDefinition !== null) {
          setState({ status: 'ready', definition: cachedDefinition, offline: true });
        }
      }
    }

    setState({ status: 'loading' });
    void loadPreset();
    return () => {
      active = false;
    };
  }, [ownerUserId, programId, reloadToken]);

  const ruleTypes = useMemo(
    () => (state.status === 'ready' ? collectRuleTypes(state.definition) : []),
    [state]
  );

  if (state.status === 'loading') {
    return (
      <Screen centered>
        <ActivityIndicator color={colors.textPrimary} />
        <Text style={styles.body}>{t('programs.preset.loading')}</Text>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen centered>
        <Text style={styles.title}>{t('programs.preset.load_error_title')}</Text>
        <Text style={styles.body}>{t('programs.preset.load_error_body')}</Text>
        <Button
          accessibilityLabel={t('programs.preset.retry_accessibility')}
          label={t('common.retry')}
          onPress={() => setReloadToken((current) => current + 1)}
        />
        <Button
          accessibilityLabel={t('common.back_accessibility')}
          label={t('common.back')}
          onPress={onBack}
        />
      </Screen>
    );
  }

  const { definition } = state;
  const estimatedWeeks = Math.ceil(definition.totalWorkouts / definition.workoutsPerWeek);

  async function handleStart(): Promise<void> {
    if (submitting) return;
    const config = buildConfigCandidate(definition, values);
    const validation = validateProgramConfig(definition, config);
    if (!validation.success) {
      setIssues(validation.issues);
      setSubmitError(false);
      return;
    }

    setIssues([]);
    setSubmitError(false);
    setSubmitting(true);
    try {
      const detail = await startPresetProgram({
        ownerUserId,
        definition,
        name: definition.name,
        config: validation.config,
      });
      onCreated(detail.id);
    } catch {
      setSubmitError(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Pressable
          accessibilityLabel={t('common.back_accessibility')}
          accessibilityRole="button"
          onPress={onBack}
          style={styles.backButton}
        >
          <Text style={styles.backLabel}>{t('common.back')}</Text>
        </Pressable>

        {state.offline ? (
          <View accessibilityRole="alert" style={styles.offlineBanner}>
            <Text style={styles.offlineText}>{t('programs.preset.offline_cached')}</Text>
          </View>
        ) : null}

        <View style={styles.heading}>
          <Text style={styles.eyebrow}>{t('programs.preset.eyebrow')}</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {definition.name}
          </Text>
          <Text style={styles.body}>{definition.description}</Text>
          <Text style={styles.meta}>
            {t('programs.preset.schedule', {
              total: definition.totalWorkouts,
              perWeek: definition.workoutsPerWeek,
              weeks: estimatedWeeks,
            })}
          </Text>
        </View>

        <Card>
          <Text style={styles.sectionTitle}>{t('programs.preset.days_title')}</Text>
          {definition.days.map((day) => (
            <View key={day.name} style={styles.day}>
              <Text style={styles.dayTitle}>{day.name}</Text>
              {day.slots.map((slot) => (
                <Text key={slot.id} style={styles.body}>
                  {definition.exercises[slot.exerciseId]?.name ?? slot.exerciseId} · {slot.tier}
                </Text>
              ))}
            </View>
          ))}
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>{t('programs.preset.rules_title')}</Text>
          {ruleTypes.map((ruleType) => (
            <Text key={ruleType} style={styles.body}>
              {t(`programs.preset.rules.${ruleType}`)}
            </Text>
          ))}
        </Card>

        <Card>
          <Text style={styles.sectionTitle}>
            {definition.configTitle ?? t('programs.preset.setup_title')}
          </Text>
          <Text style={styles.body}>
            {definition.configDescription ?? t('programs.preset.setup_body')}
          </Text>
          {definition.configFields.map((field) => {
            const issue = findFieldIssue(issues, field.key);
            if (field.type === 'weight') {
              return (
                <View key={field.key} style={styles.field}>
                  <Text style={styles.label}>{field.label}</Text>
                  <TextInput
                    accessibilityLabel={t('programs.preset.field_accessibility', {
                      label: field.label,
                    })}
                    keyboardType="decimal-pad"
                    onChangeText={(value) =>
                      setValues((current) => ({ ...current, [field.key]: value }))
                    }
                    style={styles.input}
                    value={values[field.key] ?? ''}
                  />
                  <Text style={styles.hint}>
                    {t('programs.preset.weight_hint', {
                      min: field.min,
                      step: field.step,
                    })}
                  </Text>
                  {issue ? (
                    <Text accessibilityRole="alert" style={styles.error}>
                      {t(`programs.preset.validation.${issue.code}`)}
                    </Text>
                  ) : null}
                </View>
              );
            }

            return (
              <View key={field.key} style={styles.field}>
                <Text style={styles.label}>{field.label}</Text>
                <View style={styles.options}>
                  {field.options.map((option) => {
                    const selected = values[field.key] === option.value;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        key={option.value}
                        onPress={() =>
                          setValues((current) => ({
                            ...current,
                            [field.key]: option.value,
                          }))
                        }
                        style={[styles.option, selected ? styles.optionSelected : null]}
                      >
                        <Text style={styles.optionLabel}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {issue ? (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {t(`programs.preset.validation.${issue.code}`)}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </Card>

        <View style={styles.onlineNote}>
          <Text style={styles.onlineText}>{t('programs.preset.online_only')}</Text>
        </View>
        {submitError ? (
          <Text accessibilityRole="alert" style={styles.error}>
            {t('programs.preset.create_error')}
          </Text>
        ) : null}
        <Button
          accessibilityLabel={t('programs.preset.start_accessibility', {
            name: definition.name,
          })}
          isLoading={submitting}
          label={t('programs.preset.start')}
          onPress={() => {
            void handleStart();
          }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: spacing.stackLarge,
    paddingBottom: 32,
  },
  backButton: {
    minHeight: 44,
    alignItems: 'center',
    alignSelf: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  backLabel: {
    color: colors.accentPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  offlineBanner: {
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.accentWarning,
    padding: spacing.card,
  },
  offlineText: {
    color: colors.accentWarning,
    fontSize: 14,
    lineHeight: 20,
  },
  heading: {
    gap: 8,
  },
  eyebrow: {
    color: colors.accentPrimary,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  day: {
    gap: 6,
  },
  dayTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  body: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  meta: {
    color: colors.accentPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  field: {
    gap: 8,
  },
  label: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  input: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    color: colors.textPrimary,
    fontSize: 16,
    paddingHorizontal: 14,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  option: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 16,
  },
  optionSelected: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.card,
  },
  optionLabel: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  onlineNote: {
    borderRadius: radii.card,
    backgroundColor: colors.card,
    padding: spacing.card,
  },
  onlineText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  error: {
    color: colors.textError,
    fontSize: 14,
    lineHeight: 20,
  },
});
