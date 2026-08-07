import type { CatalogEntry } from '@gzclp/domain';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radii, spacing, typography } from '../../app/design';
import {
  listProgramSummaries,
  type ProgramSummary,
  upsertProgramSummaries,
} from '../../lib/programs/program-repository';
import {
  buildDefaultProgramConfig,
  createProgramInstance,
  fetchCatalogDefinition,
  fetchCatalogEntries,
  fetchProgramSummaries,
} from '../../lib/programs/program-service';
import {
  upsertProgramDefinition,
  upsertProgramDetail,
} from '../../lib/tracker/program-detail-repository';
import { TrackerScreen } from '../tracker/tracker-screen';

type ProgramsScreenProps = {
  readonly onOpenProgram?: (programInstanceId: string) => void;
};

function mergeProgramSummary(
  programs: readonly ProgramSummary[],
  nextProgram: ProgramSummary
): ProgramSummary[] {
  return [nextProgram, ...programs.filter((program) => program.id !== nextProgram.id)];
}

export function ProgramsScreen({ onOpenProgram }: ProgramsScreenProps = {}) {
  const { t } = useTranslation();
  const [programs, setPrograms] = useState<readonly ProgramSummary[]>([]);
  const [catalog, setCatalog] = useState<readonly CatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [localProgramId, setLocalProgramId] = useState<string | null>(null);
  const [creatingProgramId, setCreatingProgramId] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function loadPrograms(signal: { readonly active: boolean }): Promise<void> {
    try {
      const cachedPrograms = await listProgramSummaries();
      if (!signal.active) return;

      setPrograms(cachedPrograms);
      setError(null);
      setSyncNotice(null);
      if (cachedPrograms.length > 0) setLoading(false);

      try {
        const remotePrograms = await fetchProgramSummaries();
        await upsertProgramSummaries(remotePrograms);
        const refreshedPrograms = await listProgramSummaries();
        if (!signal.active) return;

        setPrograms(refreshedPrograms);
        setSyncNotice(null);
        setError(null);
      } catch {
        if (!signal.active) return;
        if (cachedPrograms.length === 0) {
          setError(t('programs.errors.sync'));
        } else {
          setSyncNotice(t('programs.sync_notice'));
        }
      }
    } catch {
      if (signal.active) {
        setPrograms([]);
        setError(t('programs.errors.load'));
        setSyncNotice(null);
      }
    } finally {
      if (signal.active) setLoading(false);
    }
  }

  async function loadCatalog(signal: { readonly active: boolean }): Promise<void> {
    try {
      const catalogEntries = await fetchCatalogEntries();
      if (!signal.active) return;
      setCatalog(catalogEntries);
      setCatalogError(null);
    } catch {
      if (signal.active) {
        setCatalog([]);
        setCatalogError(t('programs.errors.catalog'));
      }
    } finally {
      if (signal.active) setCatalogLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    const signal = {
      get active() {
        return active;
      },
    };

    setLoading(true);
    setCatalogLoading(true);
    void loadPrograms(signal);
    void loadCatalog(signal);

    return () => {
      active = false;
    };
  }, [reloadToken]);

  function handleRetry(): void {
    setReloadToken((value) => value + 1);
  }

  function openProgram(programInstanceId: string): void {
    if (onOpenProgram) {
      onOpenProgram(programInstanceId);
      return;
    }
    setLocalProgramId(programInstanceId);
  }

  async function handleCreateProgram(entry: CatalogEntry): Promise<void> {
    if (creatingProgramId) return;

    setCreatingProgramId(entry.id);
    setCatalogError(null);
    try {
      const definition = await fetchCatalogDefinition(entry.id);
      const detail = await createProgramInstance({
        programId: definition.id,
        name: definition.name,
        config: buildDefaultProgramConfig(definition),
      });
      const nextSummary = {
        id: detail.id,
        title: detail.name,
        updatedAt: detail.updatedAt,
      };
      const nextPrograms = mergeProgramSummary(programs, nextSummary);

      await upsertProgramDefinition(definition);
      await upsertProgramDetail(detail);
      await upsertProgramSummaries(nextPrograms);

      if (!mountedRef.current) return;

      setPrograms(nextPrograms);
      setSyncNotice(null);
      setError(null);
      openProgram(detail.id);
    } catch {
      if (mountedRef.current) {
        setCatalogError(t('programs.errors.start'));
      }
    } finally {
      if (mountedRef.current) {
        setCreatingProgramId(null);
      }
    }
  }

  if (localProgramId) {
    return (
      <TrackerScreen programInstanceId={localProgramId} onBack={() => setLocalProgramId(null)} />
    );
  }

  const featuredProgram = programs[0];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>{t('programs.eyebrow')}</Text>
            <Text style={styles.title}>{t('programs.title')}</Text>
          </View>
          <View
            accessible
            accessibilityLabel={t('programs.local_ready')}
            accessibilityRole="text"
            style={styles.syncDot}
          >
            <View style={styles.syncDotCore} />
          </View>
        </View>

        {loading ? (
          <View style={styles.stateBlock}>
            <ActivityIndicator color={colors.accentPrimary} />
            <Text style={styles.stateText}>{t('programs.loading')}</Text>
          </View>
        ) : error ? (
          <View style={styles.stateBlock}>
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
            <Pressable accessibilityRole="button" onPress={handleRetry} style={styles.retryButton}>
              <Text style={styles.retryLabel}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {syncNotice ? (
              <View style={styles.syncNoticeBlock}>
                <View style={styles.noticeCopy}>
                  <View style={styles.noticeIndicator} />
                  <Text style={styles.syncNotice}>{syncNotice}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleRetry}
                  style={styles.noticeRetry}
                >
                  <Text style={styles.noticeRetryLabel}>{t('common.retry')}</Text>
                </Pressable>
              </View>
            ) : null}

            {featuredProgram ? (
              <View style={styles.nextSection}>
                <Text style={styles.sectionLabel}>{t('programs.next_title')}</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => openProgram(featuredProgram.id)}
                  style={({ pressed }) => [styles.heroCard, pressed ? styles.cardPressed : null]}
                >
                  <View style={styles.heroTopRow}>
                    <View style={styles.heroBadge}>
                      <Text style={styles.heroBadgeLabel}>{t('programs.active')}</Text>
                    </View>
                    <Text style={styles.heroArrow}>→</Text>
                  </View>
                  <Text style={styles.heroTitle}>{featuredProgram.title}</Text>
                  <Text style={styles.heroMeta}>
                    {t('programs.card_updated', { date: featuredProgram.updatedAt.slice(0, 10) })}
                  </Text>
                  <View style={styles.heroAction}>
                    <Text style={styles.heroActionLabel}>{t('programs.continue')}</Text>
                  </View>
                </Pressable>
              </View>
            ) : (
              <View style={styles.firstRun}>
                <View style={styles.emptyGlyph}>
                  <View style={styles.emptyGlyphBar} />
                </View>
                <Text style={styles.firstRunTitle}>{t('programs.first_run.title')}</Text>
                <Text style={styles.firstRunBody}>{t('programs.first_run.body')}</Text>
              </View>
            )}

            {programs.length > 1 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>{t('programs.your_programs')}</Text>
                <View style={styles.programList}>
                  {programs.slice(1).map((program) => (
                    <Pressable
                      key={program.id}
                      accessibilityRole="button"
                      onPress={() => openProgram(program.id)}
                      style={({ pressed }) => [
                        styles.programRow,
                        pressed ? styles.cardPressed : null,
                      ]}
                    >
                      <View style={styles.programMonogram}>
                        <Text style={styles.programMonogramText}>{program.title.slice(0, 1)}</Text>
                      </View>
                      <View style={styles.programCopy}>
                        <Text style={styles.cardTitle}>{program.title}</Text>
                        <Text style={styles.cardMeta}>
                          {t('programs.card_updated', { date: program.updatedAt.slice(0, 10) })}
                        </Text>
                      </View>
                      <Text style={styles.rowArrow}>›</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHeadingRow}>
                <Text style={styles.sectionTitle}>{t('programs.catalog_title')}</Text>
                <Text style={styles.sectionCount}>{catalog.length}</Text>
              </View>
              {catalogLoading ? (
                <View style={styles.catalogStateBlock}>
                  <ActivityIndicator color={colors.accentPrimary} />
                </View>
              ) : catalogError ? (
                <View style={styles.catalogStateBlock}>
                  <Text accessibilityRole="alert" style={styles.error}>
                    {catalogError}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={handleRetry}
                    style={styles.retryButton}
                  >
                    <Text style={styles.retryLabel}>{t('common.retry')}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.catalogList}>
                  {catalog.map((entry) => {
                    const isCreating = creatingProgramId === entry.id;
                    return (
                      <View key={entry.id} style={styles.catalogCard}>
                        <View style={styles.catalogIcon}>
                          <View style={styles.catalogBar} />
                        </View>
                        <View style={styles.catalogCopy}>
                          <Text style={styles.cardTitle}>{entry.name}</Text>
                          <Text numberOfLines={2} style={styles.cardDescription}>
                            {entry.description}
                          </Text>
                          <Text style={styles.catalogMeta}>
                            {t('programs.catalog_meta', {
                              level: entry.level,
                              total: entry.totalWorkouts,
                              perWeek: entry.workoutsPerWeek,
                            })}
                          </Text>
                        </View>
                        <Pressable
                          accessibilityLabel={t('programs.start_accessibility', {
                            name: entry.name,
                          })}
                          accessibilityRole="button"
                          disabled={creatingProgramId !== null}
                          onPress={() => {
                            void handleCreateProgram(entry);
                          }}
                          style={({ pressed }) => [
                            styles.startButton,
                            isCreating ? styles.startButtonDisabled : null,
                            pressed && !creatingProgramId ? styles.primaryPressed : null,
                          ]}
                        >
                          {isCreating ? (
                            <ActivityIndicator color={colors.textOnAccent} size="small" />
                          ) : (
                            <Text style={styles.startLabel}>{t('programs.start')}</Text>
                          )}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.canvas },
  content: {
    paddingHorizontal: spacing.screenX,
    paddingTop: spacing.screenTop,
    paddingBottom: 36,
    gap: spacing.stackLarge,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerCopy: { gap: 3 },
  eyebrow: {
    color: colors.accentPrimary,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: { color: colors.textPrimary, fontSize: typography.screenTitle, fontWeight: '800' },
  syncDot: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
  },
  syncDotCore: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentInfo },
  stateBlock: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  stateText: { color: colors.textMuted, fontSize: typography.caption },
  error: {
    color: colors.textError,
    fontSize: typography.body,
    lineHeight: 22,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 18,
  },
  retryLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  syncNoticeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    padding: 12,
  },
  noticeCopy: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  noticeIndicator: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accentWarning,
    marginTop: 6,
  },
  syncNotice: { flex: 1, color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  noticeRetry: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  noticeRetryLabel: { color: colors.accentInfo, fontSize: 13, fontWeight: '800' },
  nextSection: { gap: 10 },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: typography.caption,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  heroCard: {
    overflow: 'hidden',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.cardElevated,
    padding: 18,
    gap: 8,
  },
  cardPressed: { opacity: 0.78 },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroBadge: {
    borderRadius: radii.pill,
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  heroBadgeLabel: {
    color: colors.textOnAccent,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  heroArrow: { color: colors.accentPrimary, fontSize: 26, fontWeight: '600' },
  heroTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: '800', marginTop: 4 },
  heroMeta: { color: colors.textMuted, fontSize: typography.caption },
  heroAction: {
    alignSelf: 'flex-start',
    borderTopWidth: 1,
    borderColor: colors.borderSubtle,
    paddingTop: 12,
    marginTop: 8,
  },
  heroActionLabel: { color: colors.accentPrimary, fontSize: 14, fontWeight: '800' },
  firstRun: {
    alignItems: 'center',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    padding: 24,
    gap: 8,
  },
  emptyGlyph: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.card,
    marginBottom: 4,
  },
  emptyGlyphBar: { width: 22, height: 4, borderRadius: 2, backgroundColor: colors.accentPrimary },
  firstRunTitle: { color: colors.textPrimary, fontSize: 19, fontWeight: '800' },
  firstRunBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  section: { gap: 10 },
  sectionHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: { color: colors.textPrimary, fontSize: typography.sectionTitle, fontWeight: '800' },
  sectionCount: { color: colors.textMuted, fontSize: typography.caption, fontWeight: '700' },
  programList: {
    overflow: 'hidden',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  programRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  programMonogram: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control,
    backgroundColor: colors.cardElevated,
  },
  programMonogramText: { color: colors.accentPrimary, fontSize: 17, fontWeight: '900' },
  programCopy: { flex: 1, gap: 3 },
  cardTitle: { color: colors.textPrimary, fontSize: typography.cardTitle, fontWeight: '700' },
  cardMeta: { color: colors.textMuted, fontSize: typography.caption },
  rowArrow: { color: colors.textMuted, fontSize: 24 },
  catalogStateBlock: { alignItems: 'center', gap: 12, paddingVertical: 28 },
  catalogList: {
    overflow: 'hidden',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  catalogCard: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    backgroundColor: colors.surface,
    padding: 14,
  },
  catalogIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  catalogBar: { width: 20, height: 3, borderRadius: 2, backgroundColor: colors.textMuted },
  catalogCopy: { flex: 1, gap: 3 },
  cardDescription: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },
  catalogMeta: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  startButton: {
    minWidth: 58,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control,
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: 12,
  },
  startButtonDisabled: { opacity: 0.55 },
  startLabel: { color: colors.textOnAccent, fontSize: 12, fontWeight: '900' },
  primaryPressed: { backgroundColor: colors.accentPrimaryPressed },
});
