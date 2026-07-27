import { useEffect, useMemo, useRef, useState } from 'react';
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

import type { SupportedLanguage } from '../../lib/i18n';
import {
  formatLocalizedWeight,
  parseLocalizedWeight,
} from '../../lib/programs/localized-weight-input';
import {
  localizeDayName,
  localizeDefinitionDescription,
  localizeDefinitionName,
  localizeExerciseName,
  localizeFieldLabel,
  localizeSelectOption,
  localizeTier,
} from '../../lib/programs/program-content';
import { readPendingCreateReconciliation } from '../../lib/programs/program-repository';
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

function toInputValues(config: ProgramConfig, language: SupportedLanguage): Record<string, string> {
  return Object.fromEntries(
    Object.entries(config).map(([key, value]) => [
      key,
      typeof value === 'number' ? formatLocalizedWeight(value, language) : value,
    ])
  );
}

function buildConfigCandidate(
  definition: ProgramDefinition,
  values: Readonly<Record<string, string>>,
  language: SupportedLanguage
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

    const parsed = parseLocalizedWeight(rawValue, language);
    config[field.key] = parsed.success ? parsed.value : rawValue;
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
  const { i18n, t } = useTranslation();
  const [state, setState] = useState<PresetState>({ status: 'loading' });
  const [values, setValues] = useState<Record<string, string>>({});
  const [issues, setIssues] = useState<readonly ProgramConfigIssue[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitOutcome, setSubmitOutcome] = useState<
    | { readonly status: 'remote_error' }
    | { readonly status: 'reconciliation_required'; readonly programInstanceId: string | null }
    | null
  >(null);
  const [reloadToken, setReloadToken] = useState(0);
  const dirtyFieldsRef = useRef(new Set<string>());
  const valuesInitializedRef = useRef(false);
  const submittingRef = useRef(false);
  const language: SupportedLanguage = i18n.resolvedLanguage === 'es' ? 'es' : 'en';
  const languageRef = useRef(language);
  const previousLanguageRef = useRef(language);
  languageRef.current = language;

  useEffect(() => {
    let active = true;
    dirtyFieldsRef.current.clear();
    valuesInitializedRef.current = false;

    function applyDefinition(definition: ProgramDefinition): void {
      const defaults = toInputValues(buildDefaultProgramConfig(definition), languageRef.current);
      setValues((current) => {
        if (!valuesInitializedRef.current) {
          valuesInitializedRef.current = true;
          return defaults;
        }
        return Object.fromEntries(
          Object.entries(defaults).map(([key, value]) => [
            key,
            dirtyFieldsRef.current.has(key) ? (current[key] ?? value) : value,
          ])
        );
      });
    }

    async function loadPreset(): Promise<void> {
      let pendingCreate;
      try {
        pendingCreate = await readPendingCreateReconciliation(ownerUserId);
      } catch {
        if (active) {
          setState({ status: 'error' });
        }
        return;
      }
      if (active && pendingCreate !== null) {
        setSubmitOutcome({
          status: 'reconciliation_required',
          programInstanceId: pendingCreate.programInstanceId,
        });
      }

      let cachedDefinition: ProgramDefinition | null = null;
      try {
        cachedDefinition = await getProgramDefinition(ownerUserId, programId);
        if (cachedDefinition && active) {
          setState({ status: 'ready', definition: cachedDefinition, offline: false });
          applyDefinition(cachedDefinition);
        }
      } catch {
        cachedDefinition = null;
      }

      try {
        const definition = await fetchCatalogDefinition(programId);
        await upsertProgramDefinition(ownerUserId, definition);
        if (active) {
          setState({ status: 'ready', definition, offline: false });
          applyDefinition(definition);
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
    setSubmitOutcome(null);
    void loadPreset();
    return () => {
      active = false;
    };
  }, [ownerUserId, programId, reloadToken]);

  useEffect(() => {
    const previousLanguage = previousLanguageRef.current;
    previousLanguageRef.current = language;
    if (
      previousLanguage === language ||
      state.status !== 'ready' ||
      !valuesInitializedRef.current
    ) {
      return;
    }

    const defaults = toInputValues(buildDefaultProgramConfig(state.definition), language);
    const weightFieldKeys = new Set(
      state.definition.configFields
        .filter((field) => field.type === 'weight')
        .map((field) => field.key)
    );
    setValues((current) =>
      Object.fromEntries(
        Object.entries(defaults).map(([key, defaultValue]) => {
          if (!dirtyFieldsRef.current.has(key)) {
            return [key, defaultValue];
          }
          const currentValue = current[key] ?? defaultValue;
          if (!weightFieldKeys.has(key)) {
            return [key, currentValue];
          }
          const parsed = parseLocalizedWeight(currentValue, previousLanguage);
          return [
            key,
            parsed.success ? formatLocalizedWeight(parsed.value, language) : currentValue,
          ];
        })
      )
    );
  }, [language, state]);

  const ruleTypes = useMemo(
    () => (state.status === 'ready' ? collectRuleTypes(state.definition) : []),
    [state]
  );

  if (state.status === 'loading') {
    return (
      <Screen centered>
        <ActivityIndicator
          accessibilityLabel={t('programs.preset.loading')}
          accessibilityLiveRegion="polite"
          accessibilityRole="progressbar"
          color={colors.textPrimary}
        />
        <Text style={styles.body}>{t('programs.preset.loading')}</Text>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen centered>
        <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.title}>
          {t('programs.preset.load_error_title')}
        </Text>
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
  const localizedName = localizeDefinitionName(definition, t);
  const localizedDescription = localizeDefinitionDescription(definition, t);
  const estimatedWeeks = Math.ceil(definition.totalWorkouts / definition.workoutsPerWeek);

  async function handleStart(): Promise<void> {
    if (submittingRef.current || submitOutcome?.status === 'reconciliation_required') return;
    submittingRef.current = true;
    const config = buildConfigCandidate(definition, values, language);
    const validation = validateProgramConfig(definition, config);
    if (!validation.success) {
      setIssues(validation.issues);
      setSubmitOutcome(null);
      submittingRef.current = false;
      return;
    }

    setIssues([]);
    setSubmitOutcome(null);
    setSubmitting(true);
    try {
      const result = await startPresetProgram({
        ownerUserId,
        definition,
        name: localizedName,
        config: validation.config,
      });
      if (result.status === 'applied') {
        onCreated(result.remote.id);
      } else {
        setSubmitOutcome({
          status: 'reconciliation_required',
          programInstanceId: result.remote?.id ?? result.remoteEntityId,
        });
      }
    } catch {
      setSubmitOutcome({ status: 'remote_error' });
    } finally {
      submittingRef.current = false;
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
            {localizedName}
          </Text>
          <Text style={styles.body}>{localizedDescription}</Text>
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
          {definition.days.map((day, dayIndex) => (
            <View key={`${definition.id}:${dayIndex}`} style={styles.day}>
              <Text style={styles.dayTitle}>{localizeDayName(definition.id, day.name, t)}</Text>
              {day.slots.map((slot) => (
                <Text key={slot.id} style={styles.body}>
                  {localizeExerciseName(
                    definition.id,
                    slot.exerciseId,
                    definition.exercises[slot.exerciseId]?.name,
                    t
                  )}{' '}
                  · {localizeTier(slot.tier, t)}
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
          <Text style={styles.sectionTitle}>{t('programs.preset.setup_title')}</Text>
          <Text style={styles.body}>{t('programs.preset.setup_body')}</Text>
          {definition.configFields.map((field) => {
            const issue = findFieldIssue(issues, field.key);
            const localizedLabel = localizeFieldLabel(definition.id, field.key, field.label, t);
            if (field.type === 'weight') {
              return (
                <View key={field.key} style={styles.field}>
                  <Text style={styles.label}>{localizedLabel}</Text>
                  <TextInput
                    accessibilityLabel={t('programs.preset.field_accessibility', {
                      label: localizedLabel,
                    })}
                    keyboardType="decimal-pad"
                    onChangeText={(value) =>
                      setValues((current) => {
                        dirtyFieldsRef.current.add(field.key);
                        return { ...current, [field.key]: value };
                      })
                    }
                    style={styles.input}
                    value={values[field.key] ?? ''}
                  />
                  <Text style={styles.hint}>
                    {t('programs.preset.weight_hint', {
                      min: formatLocalizedWeight(field.min, language),
                      step: formatLocalizedWeight(field.step, language),
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
                <Text style={styles.label}>{localizedLabel}</Text>
                <View style={styles.options}>
                  {field.options.map((option) => {
                    const selected = values[field.key] === option.value;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        key={option.value}
                        onPress={() =>
                          setValues((current) => {
                            dirtyFieldsRef.current.add(field.key);
                            return {
                              ...current,
                              [field.key]: option.value,
                            };
                          })
                        }
                        style={[styles.option, selected ? styles.optionSelected : null]}
                      >
                        <Text style={styles.optionLabel}>
                          {localizeSelectOption(
                            definition.id,
                            field.key,
                            option.value,
                            option.label,
                            t,
                            language
                          )}
                        </Text>
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
        {submitOutcome ? (
          <Text accessibilityLiveRegion="assertive" accessibilityRole="alert" style={styles.error}>
            {t(
              submitOutcome.status === 'reconciliation_required'
                ? 'programs.preset.reconciliation_required'
                : 'programs.preset.create_error'
            )}
          </Text>
        ) : null}
        {submitOutcome?.status === 'reconciliation_required' &&
        submitOutcome.programInstanceId !== null ? (
          <Button
            accessibilityLabel={t('programs.preset.open_acknowledged_accessibility')}
            label={t('programs.preset.open_acknowledged')}
            onPress={() => {
              const programInstanceId = submitOutcome.programInstanceId;
              if (programInstanceId !== null) {
                onCreated(programInstanceId);
              }
            }}
          />
        ) : null}
        <Button
          accessibilityLabel={t('programs.preset.start_accessibility', {
            name: localizedName,
          })}
          isLoading={submitting}
          label={t('programs.preset.start')}
          disabled={submitOutcome?.status === 'reconciliation_required'}
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
